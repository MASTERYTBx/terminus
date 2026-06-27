"use client";

import React, { useState, useMemo } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Boxes,
  RefreshCw,
  Settings as SettingsIcon,
  Search,
  Plus,
  Download,
  ExternalLink,
  Lock,
  Check,
  Copy,
  Trash2,
  Archive,
  AlertTriangle,
  TrendingUp,
  UserCheck,
  MessageSquare,
  DollarSign,
  AlertCircle,
  Calendar,
  Truck,
  PlusCircle,
  MinusCircle,
  Database,
  Smartphone,
  MapPin,
  Tag,
  Eye,
  EyeOff,
  Edit2,
  Info,
  FileText,
  Printer,
  Fingerprint,
  ShieldAlert
} from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";

interface Workspace {
  id: string;
  name: string;
  niche: string;
  currency: string;
}

interface Product {
  id: string; // SKU
  name: string;
  price: number; // Selling Price (Tk)
  cost: number;  // Cost Price (Tk)
  stock: number;
  category: string;
  workspaceId: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  district: "inside" | "outside";
  fraudFlag: boolean;
  returnRate: number; // e.g., 20 for 20%
  blacklisted: boolean;
  workspaceId: string;
}

interface OrderItem {
  productId: string;
  quantity: number;
}

interface Order {
  id: string;
  date: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  status: "Pending" | "Confirmed" | "Dispatched" | "Delivered" | "Returned";
  tracking: string;
  courier: "Pathao" | "Steadfast" | "RedX" | "None";
  workspaceId: string;
  isArchived?: boolean;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  items: string;
  value: number;
  date: string;
  workspaceId: string;
}

interface DBUser {
  username: string;
  password?: string;
  role: "Admin" | "Non-Admin";
  assignedWorkspaces: string[];
  passwordVersion: number;
}

// ==========================================
// INITIAL MOCK DATABASE SEED
// ==========================================

const INITIAL_WORKSPACES: Workspace[] = [];
const INITIAL_PRODUCTS: Product[] = [];
const INITIAL_CUSTOMERS: Customer[] = [];
const INITIAL_ORDERS: Order[] = [];
const INITIAL_LEADS: Lead[] = [];

const MOCK_DMS = [
  { sender: "Ayesha Siddiqua", message: "Do you have the matte lipstick in shade 04?", time: "4 min ago" },
  { sender: "Nabila Anjum", message: "Can I get the golden pearl necklace by Friday? Delivery is in Chittagong.", time: "18 min ago" },
  { sender: "Fahim Ahmed", message: "I want to order the zirconium couple rings.", time: "35 min ago" },
  { sender: "Mehnaz Karim", message: "Is the organic face serum safe for sensitive skin?", time: "2 hr ago" },
  { sender: "Sadia Rahman", message: "Placed an order yesterday but haven't received confirmation.", time: "5 hr ago" }
];

export default function Home() {
  // ==========================================
  // AUTHENTICATION & MULTI-TENANT STATES
  // ==========================================
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [dbStatus, setDbStatus] = useState<"connecting" | "synced" | "local">("connecting");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // ==========================================
  // MULTI-USER IAM & RBAC STATES
  // ==========================================
  const [users, setUsers] = useState<DBUser[]>([]);
  const [sessionUser, setSessionUser] = useState<DBUser | null>(null);
  
  // Account Panel Form States
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"Admin" | "Non-Admin">("Non-Admin");
  const [newUserWorkspaces, setNewUserWorkspaces] = useState<string[]>([]);
  
  // Password Reset states
  const [resettingUser, setResettingUser] = useState<DBUser | null>(null);
  const [newResetPassword, setNewResetPassword] = useState("");

  // Password visibility states (per user)
  const [showPasswords, setShowPasswords] = useState<{ [username: string]: boolean }>({});

  const [workspaces, setWorkspaces] = useState<Workspace[]>(INITIAL_WORKSPACES);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [isWorkspaceCreateOpen, setIsWorkspaceCreateOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsNiche, setNewWsNiche] = useState("Jewelry");
  const [newWsCurrency, setNewWsCurrency] = useState("Tk");

  // Smart Paste States
  const [smartPasteText, setSmartPasteText] = useState("");

  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "customers" | "stock" | "recovery" | "settings" | "accounts">("dashboard");

  // Database States (Global across all tenants)
  const [inventory, setInventory] = useState<Product[]>(INITIAL_PRODUCTS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);

  // Search & Filter States
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("All");
  const [customerSearch, setCustomerSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>("All");

  // Modals & Selection States
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [selectedCustomerProfileId, setSelectedCustomerProfileId] = useState<string | null>(null);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkCourier, setBulkCourier] = useState<"Pathao" | "Steadfast" | "RedX">("Steadfast");
  const [isWsDropdownOpen, setIsWsDropdownOpen] = useState(false);

  // Create Order Slip States
  const [slipPhone, setSlipPhone] = useState("");
  const [slipName, setSlipName] = useState("");
  const [slipAddress, setSlipAddress] = useState("");
  const [slipDistrict, setSlipDistrict] = useState<"inside" | "outside">("inside");
  const [slipItems, setSlipItems] = useState<OrderItem[]>([]);
  const [slipSelectedProductId, setSlipSelectedProductId] = useState(INITIAL_PRODUCTS.length > 0 ? INITIAL_PRODUCTS[0].id : "");
  const [slipDiscount, setSlipDiscount] = useState(0);

  // Add Product Form States
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProdId, setNewProdId] = useState("");
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Rings");
  const [newProdCost, setNewProdCost] = useState(0);
  const [newProdPrice, setNewProdPrice] = useState(0);
  const [newProdStock, setNewProdStock] = useState(0);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Success indicators
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Settings
  const [shippingInside, setShippingInside] = useState(60);
  const [shippingOutside, setShippingOutside] = useState(130);
  const [shopName, setShopName] = useState("TERMINUS Jewelry BD");

  // Persistent Login & Session hook
  React.useEffect(() => {
    async function initConnection() {
      if (typeof window === "undefined") return;

      const defaultMaster: DBUser = {
        username: "masteryousha",
        password: "@qazplm69",
        role: "Admin",
        assignedWorkspaces: [],
        passwordVersion: 1
      };

      const auth = localStorage.getItem("terminus_auth") === "true";
      const ws = localStorage.getItem("terminus_active_workspace_id");
      
      const tab = localStorage.getItem("terminus_active_tab");
      if (tab) {
        setActiveTab(tab as any);
      }

      // Load local copies from localStorage (offline first!)
      const storedWorkspaces = localStorage.getItem("terminus_workspaces");
      if (storedWorkspaces) {
        try { setWorkspaces(JSON.parse(storedWorkspaces)); } catch (e) {}
      }
      const storedInventory = localStorage.getItem("terminus_inventory");
      if (storedInventory) {
        try { setInventory(JSON.parse(storedInventory)); } catch (e) {}
      }
      const storedCustomers = localStorage.getItem("terminus_customers");
      if (storedCustomers) {
        try { setCustomers(JSON.parse(storedCustomers)); } catch (e) {}
      }
      const storedOrders = localStorage.getItem("terminus_orders");
      if (storedOrders) {
        try { setOrders(JSON.parse(storedOrders)); } catch (e) {}
      }
      const storedLeads = localStorage.getItem("terminus_leads");
      if (storedLeads) {
        try { setLeads(JSON.parse(storedLeads)); } catch (e) {}
      }
      const storedUsers = localStorage.getItem("terminus_users");
      if (storedUsers) {
        try { setUsers(JSON.parse(storedUsers)); } catch (e) {}
      } else {
        setUsers([defaultMaster]);
      }

      // Initial Local Session Setup
      const sessionStr = localStorage.getItem("terminus_session_user");
      let activeUser: DBUser | null = null;
      if (sessionStr) {
        try {
          activeUser = JSON.parse(sessionStr);
          setSessionUser(activeUser);
        } catch (e) {}
      }
      
      // Perform security check on active session load
      if (auth && activeUser) {
        setIsAuthenticated(true);
        if (activeUser.role === "Non-Admin") {
          if (!ws || !activeUser.assignedWorkspaces.includes(ws)) {
            const firstAllowed = activeUser.assignedWorkspaces.length > 0 ? activeUser.assignedWorkspaces[0] : null;
            setCurrentWorkspaceId(firstAllowed);
            if (firstAllowed) {
              localStorage.setItem("terminus_active_workspace_id", firstAllowed);
            } else {
              localStorage.removeItem("terminus_active_workspace_id");
            }
          } else {
            setCurrentWorkspaceId(ws);
          }
        } else {
          setCurrentWorkspaceId(ws);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentWorkspaceId(ws);
      }

      const storedShippingInside = localStorage.getItem("terminus_shipping_inside");
      if (storedShippingInside) setShippingInside(Number(storedShippingInside));

      const storedShippingOutside = localStorage.getItem("terminus_shipping_outside");
      if (storedShippingOutside) setShippingOutside(Number(storedShippingOutside));

      // Now test the Supabase connection!
      try {
        const { data, error } = await supabase
          .from("workspaces")
          .select("id")
          .limit(1);

        if (error) {
          console.warn("Supabase connection offline/uninitialized. Falling back to local offline mode.");
          setDbStatus("local");
        } else {
          setDbStatus("synced");
          
          // Since it's connected, load all tables from Supabase to overwrite local copies!
          const { data: dbWs } = await supabase.from("workspaces").select("*");
          if (dbWs) {
            setWorkspaces(dbWs);
            if (dbWs.length === 0) {
              setCurrentWorkspaceId(null);
              localStorage.removeItem("terminus_active_workspace_id");
            } else if (ws && !dbWs.some((w: any) => w.id === ws)) {
              if (activeUser && activeUser.role === "Non-Admin") {
                const firstAllowed = activeUser.assignedWorkspaces.length > 0 ? activeUser.assignedWorkspaces[0] : null;
                setCurrentWorkspaceId(firstAllowed);
                if (firstAllowed) {
                  localStorage.setItem("terminus_active_workspace_id", firstAllowed);
                } else {
                  localStorage.removeItem("terminus_active_workspace_id");
                }
              } else {
                setCurrentWorkspaceId(dbWs[0].id);
                localStorage.setItem("terminus_active_workspace_id", dbWs[0].id);
              }
            }
          }

          const { data: dbProducts } = await supabase.from("products").select("*");
          if (dbProducts) {
            const mapped = dbProducts.map((p: any) => ({
              id: p.id,
              name: p.name,
              price: Number(p.price),
              cost: Number(p.cost),
              stock: Number(p.stock),
              category: p.category,
              workspaceId: p.workspace_id
            }));
            setInventory(mapped);
          }

          const { data: dbCustomers } = await supabase.from("customers").select("*");
          if (dbCustomers) {
            const mapped = dbCustomers.map((c: any) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              address: c.address,
              district: c.district,
              fraudFlag: c.fraud_flag,
              returnRate: Number(c.return_rate),
              blacklisted: c.blacklisted,
              workspaceId: c.workspace_id
            }));
            setCustomers(mapped);
          }

          const { data: dbOrders } = await supabase.from("orders").select("*, order_items(*)");
          if (dbOrders) {
            const mapped = dbOrders.map((o: any) => ({
              id: o.id,
              date: o.date,
              customerId: o.customer_id,
              subtotal: Number(o.subtotal),
              shipping: Number(o.shipping),
              discount: Number(o.discount),
              total: Number(o.total),
              status: o.status,
              tracking: o.tracking,
              courier: o.courier,
              workspaceId: o.workspace_id,
              isArchived: o.is_archived,
              items: (o.order_items || []).map((oi: any) => ({
                productId: oi.product_id,
                quantity: Number(oi.quantity)
              }))
            }));
            setOrders(mapped);
          }

          const { data: dbLeads } = await supabase.from("leads").select("*");
          if (dbLeads) {
            const mapped = dbLeads.map((l: any) => ({
              id: l.id,
              name: l.name,
              phone: l.phone,
              items: l.items,
              value: Number(l.value),
              date: l.date,
              workspaceId: l.workspace_id
            }));
            setLeads(mapped);
          }

          // Fetch users table from Supabase
          const { data: dbUsers, error: userError } = await supabase.from("users").select("*");
          if (!userError && dbUsers) {
            const mappedUsers = dbUsers.map((u: any) => ({
              username: u.username,
              password: u.password,
              role: u.role,
              assignedWorkspaces: u.assigned_workspaces || [],
              passwordVersion: Number(u.password_version)
            }));
            setUsers(mappedUsers);

            if (activeUser) {
              const currentLedger = mappedUsers.find(u => u.username === activeUser.username);
              if (!currentLedger || currentLedger.passwordVersion !== activeUser.passwordVersion || currentLedger.role !== activeUser.role) {
                // Instantly log out!
                setIsAuthenticated(false);
                setSessionUser(null);
                setCurrentWorkspaceId(null);
                localStorage.removeItem("terminus_auth");
                localStorage.removeItem("terminus_session_user");
                localStorage.removeItem("terminus_active_workspace_id");
              } else {
                setSessionUser(currentLedger);
                localStorage.setItem("terminus_session_user", JSON.stringify(currentLedger));
              }
            }
          }
        }
      } catch (e) {
        console.warn("Supabase connection failed. Using local storage offline mode.");
        setDbStatus("local");
      }
    }

    initConnection();
  }, []);

  // Save states to localStorage to persist user edits across reload
  React.useEffect(() => {
    if (isAuthenticated !== null && typeof window !== "undefined") {
      localStorage.setItem("terminus_workspaces", JSON.stringify(workspaces));
    }
  }, [workspaces, isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated !== null && typeof window !== "undefined") {
      localStorage.setItem("terminus_inventory", JSON.stringify(inventory));
    }
  }, [inventory, isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated !== null && typeof window !== "undefined") {
      localStorage.setItem("terminus_customers", JSON.stringify(customers));
    }
  }, [customers, isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated !== null && typeof window !== "undefined") {
      localStorage.setItem("terminus_orders", JSON.stringify(orders));
    }
  }, [orders, isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated !== null && typeof window !== "undefined") {
      localStorage.setItem("terminus_leads", JSON.stringify(leads));
    }
  }, [leads, isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated !== null && typeof window !== "undefined") {
      localStorage.setItem("terminus_active_tab", activeTab);
    }
  }, [activeTab, isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated !== null && typeof window !== "undefined") {
      localStorage.setItem("terminus_shipping_inside", String(shippingInside));
    }
  }, [shippingInside, isAuthenticated]);

  React.useEffect(() => {
    if (isAuthenticated !== null && typeof window !== "undefined") {
      localStorage.setItem("terminus_shipping_outside", String(shippingOutside));
    }
  }, [shippingOutside, isAuthenticated]);

  // Save users state to localStorage to persist user accounts across reload
  React.useEffect(() => {
    if (isAuthenticated !== null && typeof window !== "undefined") {
      localStorage.setItem("terminus_users", JSON.stringify(users));
    }
  }, [users, isAuthenticated]);

  const allowedWorkspaces = useMemo(() => {
    if (!sessionUser) return [];
    if (sessionUser.role === "Admin") return workspaces;
    return workspaces.filter(w => sessionUser.assignedWorkspaces.includes(w.id));
  }, [workspaces, sessionUser]);

  // Security validation check loop: runs on every view change
  React.useEffect(() => {
    if (!isAuthenticated || !sessionUser) return;
    
    // Find current user state in database/state ledger
    const currentLedgerUser = users.find(u => u.username === sessionUser.username);
    if (!currentLedgerUser) {
      handleLogoutWithNotice("Session Revoked: Your account has been deleted.");
      return;
    }
    
    if (currentLedgerUser.passwordVersion !== sessionUser.passwordVersion || currentLedgerUser.role !== sessionUser.role) {
      handleLogoutWithNotice("Session Expired: Your security credentials have changed. Please log in again.");
    }
  }, [activeTab, currentWorkspaceId, users, isAuthenticated, sessionUser]);

  const handleLogoutWithNotice = (msg: string) => {
    setIsAuthenticated(false);
    setSessionUser(null);
    setCurrentWorkspaceId(null);
    localStorage.removeItem("terminus_auth");
    localStorage.removeItem("terminus_session_user");
    localStorage.removeItem("terminus_active_workspace_id");
    alert(msg);
    triggerToast(msg);
  };

  // Filtered views computed specifically for the active workspace
  const activeWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === currentWorkspaceId) || null;
  }, [workspaces, currentWorkspaceId]);

  const activeInventory = useMemo(() => {
    return inventory.filter(p => p.workspaceId === currentWorkspaceId);
  }, [inventory, currentWorkspaceId]);

  const activeCustomers = useMemo(() => {
    return customers.filter(c => c.workspaceId === currentWorkspaceId);
  }, [customers, currentWorkspaceId]);

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.workspaceId === currentWorkspaceId);
  }, [orders, currentWorkspaceId]);

  const activeLeads = useMemo(() => {
    return leads.filter(l => l.workspaceId === currentWorkspaceId);
  }, [leads, currentWorkspaceId]);

  // 7-day sales trend data computation
  const salesTrendData = useMemo(() => {
    const days: string[] = [];
    const labels: string[] = [];
    const values: number[] = [];

    // Generate dates ending today (local time is 2026-06-25)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const dateVal = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${dateVal}`;
      
      days.push(dateStr);
      
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
      labels.push(i === 0 ? `${dayLabel} (Today)` : dayLabel);
    }

    days.forEach(day => {
      const dayOrders = activeOrders.filter(o => o.date.startsWith(day));
      const dayTotal = dayOrders.reduce((sum, o) => sum + o.total, 0);
      values.push(dayTotal);
    });

    const maxVal = Math.max(...values, 1000); // minimum scale ceiling

    // Compute coordinates (viewBox is 0 0 500 200)
    // X-axis: 10 + idx * 80 (since width is 500, idx ranges from 0 to 6)
    // Y-axis: 180 - (val / maxVal) * 140 (leaves 40px margin at top, 20px padding at bottom)
    const points = values.map((val, idx) => {
      const x = 10 + idx * 80;
      const y = 180 - (val / maxVal) * 140;
      return { x, y };
    });

    let linePath = "";
    let areaPath = "";

    if (points.length > 0) {
      linePath = "M " + points.map(p => `${p.x} ${p.y}`).join(" L ");
      areaPath = linePath + ` L ${points[points.length - 1].x} 190 L ${points[0].x} 190 Z`;
    }

    return { labels, values, points, linePath, areaPath };
  }, [activeOrders, activeWorkspace]);

  // Sync shop name with active workspace name
  React.useEffect(() => {
    if (activeWorkspace) {
      setShopName(activeWorkspace.name);
    }
  }, [activeWorkspace]);

  // Sync selected product input when active workspace inventory updates
  React.useEffect(() => {
    if (activeInventory.length > 0) {
      setSlipSelectedProductId(activeInventory[0].id);
    } else {
      setSlipSelectedProductId("");
    }
  }, [activeInventory]);

  // ==========================================
  // SECURITY AUTHENTICATION HANDLERS
  // ==========================================
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = loginUsername.trim().toLowerCase();
    
    const matchedUser = users.find(u => u.username === cleanUsername && u.password === loginPassword);
    
    if (matchedUser) {
      setIsAuthenticated(true);
      setSessionUser(matchedUser);
      localStorage.setItem("terminus_auth", "true");
      localStorage.setItem("terminus_session_user", JSON.stringify(matchedUser));
      setLoginError("");
      setLoginUsername("");
      setLoginPassword("");
      triggerToast(`Authorized session as: ${matchedUser.username}`);
      
      // Auto select first allowed workspace if not currently set
      if (matchedUser.role === "Non-Admin" && matchedUser.assignedWorkspaces.length > 0) {
        const firstAllowed = matchedUser.assignedWorkspaces[0];
        setCurrentWorkspaceId(firstAllowed);
        localStorage.setItem("terminus_active_workspace_id", firstAllowed);
      } else {
        // Clear workspace selection if admin doesn't have one selected yet, or keep old one
        const ws = localStorage.getItem("terminus_active_workspace_id");
        if (ws) setCurrentWorkspaceId(ws);
      }
    } else {
      setLoginError("Access Denied: Invalid Username or Password.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setSessionUser(null);
    setCurrentWorkspaceId(null);
    localStorage.removeItem("terminus_auth");
    localStorage.removeItem("terminus_session_user");
    localStorage.removeItem("terminus_active_workspace_id");
    triggerToast("Logged out successfully.");
  };

  // ==========================================
  // IAM & RBAC USER ACCOUNT MUTATORS
  // ==========================================
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = newUsername.trim().toLowerCase();
    const cleanPass = newPassword;

    if (!cleanUser || !cleanPass) {
      alert("Please specify a username and password.");
      return;
    }

    if (users.some(u => u.username === cleanUser)) {
      alert("Username already exists!");
      return;
    }

    const newUser: DBUser = {
      username: cleanUser,
      password: cleanPass,
      role: newUserRole,
      assignedWorkspaces: newUserRole === "Admin" ? [] : newUserWorkspaces,
      passwordVersion: 1
    };

    setUsers(prev => [...prev, newUser]);
    setNewUsername("");
    setNewPassword("");
    setNewUserRole("Non-Admin");
    setNewUserWorkspaces([]);
    triggerToast(`User account "${cleanUser}" created!`);

    if (dbStatus === "synced") {
      try {
        await supabase.from("users").insert([{
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          assigned_workspaces: newUser.assignedWorkspaces,
          password_version: newUser.passwordVersion
        }]);
      } catch (err) {
        console.error("Supabase user creation sync error:", err);
      }
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (username === "masteryousha") {
      alert("Error: Root Super-Admin account 'masteryousha' cannot be deleted!");
      return;
    }

    if (confirm(`Are you sure you want to permanently delete the user account "${username}"?`)) {
      setUsers(prev => prev.filter(u => u.username !== username));
      triggerToast(`User "${username}" deleted.`);

      if (dbStatus === "synced") {
        try {
          await supabase.from("users").delete().eq("username", username);
        } catch (err) {
          console.error("Supabase user deletion sync error:", err);
        }
      }
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newResetPassword) return;

    const nextVer = resettingUser.passwordVersion + 1;
    const updatedUsers = users.map(u => {
      if (u.username === resettingUser.username) {
        return {
          ...u,
          password: newResetPassword,
          passwordVersion: nextVer
        };
      }
      return u;
    });

    setUsers(updatedUsers);
    triggerToast(`Password updated for "${resettingUser.username}".`);
    
    if (dbStatus === "synced") {
      try {
        await supabase.from("users").update({
          password: newResetPassword,
          password_version: nextVer
        }).eq("username", resettingUser.username);
      } catch (err) {
        console.error("Supabase password reset sync error:", err);
      }
    }

    setResettingUser(null);
    setNewResetPassword("");
  };

  const handleUpdateUserRole = async (username: string, newRole: "Admin" | "Non-Admin") => {
    if (username === "masteryousha") {
      alert("Error: Role permissions of root Super-Admin 'masteryousha' cannot be modified!");
      return;
    }

    const updatedUsers = users.map(u => {
      if (u.username === username) {
        return {
          ...u,
          role: newRole,
          assignedWorkspaces: newRole === "Admin" ? [] : u.assignedWorkspaces
        };
      }
      return u;
    });

    setUsers(updatedUsers);
    triggerToast(`Role updated for user "${username}".`);

    if (dbStatus === "synced") {
      try {
        await supabase.from("users").update({
          role: newRole,
          assigned_workspaces: newRole === "Admin" ? [] : (users.find(u => u.username === username)?.assignedWorkspaces || [])
        }).eq("username", username);
      } catch (err) {
        console.error("Supabase user role update error:", err);
      }
    }
  };

  const handleUpdateUserWorkspaces = async (username: string, wsIds: string[]) => {
    const updatedUsers = users.map(u => {
      if (u.username === username) {
        return {
          ...u,
          assignedWorkspaces: wsIds
        };
      }
      return u;
    });

    setUsers(updatedUsers);
    triggerToast(`Assigned workspaces updated for "${username}".`);

    if (dbStatus === "synced") {
      try {
        await supabase.from("users").update({
          assigned_workspaces: wsIds
        }).eq("username", username);
      } catch (err) {
        console.error("Supabase user workspaces update error:", err);
      }
    }
  };

  // ==========================================
  // MULTI-TENANT WORKSPACE HANDLERS
  // ==========================================
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) {
      alert("Please enter a business name.");
      return;
    }
    const wsId = "WS-" + Math.floor(100 + Math.random() * 900);
    const newWs: Workspace = {
      id: wsId,
      name: newWsName.trim(),
      niche: newWsNiche,
      currency: newWsCurrency
    };
    setWorkspaces(prev => [...prev, newWs]);
    setCurrentWorkspaceId(wsId);
    localStorage.setItem("terminus_active_workspace_id", wsId);
    setNewWsName("");
    setIsWorkspaceCreateOpen(false);
    triggerToast(`Workspace "${newWs.name}" created and loaded!`);

    if (dbStatus === "synced") {
      try {
        await supabase.from("workspaces").insert([{
          id: wsId,
          name: newWs.name,
          niche: newWs.niche,
          currency: newWs.currency
        }]);
      } catch (err) {
        console.error("Supabase workspace sync error:", err);
      }
    }
  };

  const handleSystemReset = async () => {
    if (confirm("WARNING: This will permanently delete all workspaces, products, customers, orders, and leads from BOTH this browser and the connected Supabase database. Are you sure?")) {
      if (dbStatus === "synced") {
        try {
          await supabase.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          await supabase.from("orders").delete().neq("id", "");
          await supabase.from("customers").delete().neq("id", "");
          await supabase.from("products").delete().neq("id", "");
          await supabase.from("leads").delete().neq("id", "");
          await supabase.from("workspaces").delete().neq("id", "");
        } catch (err) {
          console.error("Failed to clear Supabase database:", err);
        }
      }
      localStorage.clear();
      window.location.reload();
    }
  };

  // ==========================================
  // SMART DM PASTE PARSER (REGEX & HEURISTICS)
  // ==========================================
  const parseDMText = (text: string) => {
    if (!text.trim()) return null;

    // Bangladeshi phone number pattern: 013 to 019 followed by 8 digits
    const phoneRegex = /(01[3-9]\d{8})/;
    const phoneMatch = text.match(phoneRegex);
    const phone = phoneMatch ? phoneMatch[1] : "";

    // Split text by newlines, commas, or semicolons
    const lines = text.split(/[\n,;]+/).map(l => l.trim()).filter(l => l.length > 0);

    let name = "";
    const addressParts: string[] = [];

    lines.forEach(line => {
      // Remove phone and labels
      let cleanLine = line.replace(phone, "")
        .replace(/phone|contact|mobile|ph|no\.?:?/i, "")
        .trim();
      
      cleanLine = cleanLine.replace(/^[-:,\s]+|[-:,\s]+$/g, "").trim();

      if (!cleanLine) return;

      if (cleanLine.toLowerCase().startsWith("name")) {
        name = cleanLine.replace(/^name[:\s]*/i, "").trim();
        return;
      }
      if (cleanLine.toLowerCase().startsWith("address")) {
        addressParts.push(cleanLine.replace(/^address[:\s]*/i, "").trim());
        return;
      }

      // Identify address components or fallback
      const addressIndicators = ["dhaka", "road", "house", "flat", "holding", "sector", "block", "lane", "chittagong", "sylhet", "khulna", "rajshahi", "barisal", "rangpur", "sadar", "thana", "upazila", "ward", "village", "bazar", "para", "road no", "house no"];
      const isAddress = addressIndicators.some(ind => cleanLine.toLowerCase().includes(ind));

      if (isAddress) {
        addressParts.push(cleanLine);
      } else {
        if (!name && cleanLine.length < 30 && cleanLine.split(" ").length <= 4) {
          name = cleanLine;
        } else {
          addressParts.push(cleanLine);
        }
      }
    });

    return {
      phone,
      name: name || "Customer",
      address: addressParts.join(", ")
    };
  };

  const handleSmartPasteChange = (val: string) => {
    setSmartPasteText(val);
    const parsed = parseDMText(val);
    if (parsed) {
      if (parsed.phone) {
        setSlipPhone(parsed.phone);
        // Also fire Real-time CRM lookup if phone matches existing
        const match = activeCustomers.find(c => c.phone === parsed.phone);
        if (match) {
          setSlipName(match.name);
          setSlipAddress(match.address);
          setSlipDistrict(match.district);
          triggerToast(`CRM Match: ${match.name} auto-filled`);
          return;
        }
      }
      if (parsed.name && parsed.name !== "Customer") setSlipName(parsed.name);
      if (parsed.address) {
        setSlipAddress(parsed.address);
        // Autoguess district
        if (parsed.address.toLowerCase().includes("dhaka")) {
          setSlipDistrict("inside");
        } else {
          setSlipDistrict("outside");
        }
      }
    }
  };

  // ==========================================
  // CRM REAL-TIME PHONE LOOKUP
  // ==========================================
  const handlePhoneChange = (val: string) => {
    setSlipPhone(val);
    if (val.length === 11) {
      const match = activeCustomers.find(c => c.phone === val);
      if (match) {
        setSlipName(match.name);
        setSlipAddress(match.address);
        setSlipDistrict(match.district);
        triggerToast(`CRM Match: ${match.name} auto-filled`);
      }
    }
  };

  const currentPhoneCustomerMatch = useMemo(() => {
    if (slipPhone.length === 11) {
      return activeCustomers.find(c => c.phone === slipPhone) || null;
    }
    return null;
  }, [slipPhone, activeCustomers]);

  // ==========================================
  // CORE METRICS & ANALYTICS CALCULATIONS
  // ==========================================
  const metrics = useMemo(() => {
    // Today's Revenue (Tk) - sum of Delivered + Dispatched + Confirmed orders today (or overall for mock simplicity)
    const revenue = activeOrders
      .filter(o => o.status !== "Returned")
      .reduce((sum, o) => sum + o.total, 0);

    const activeOrdersCount = activeOrders.filter(o => o.status === "Pending" || o.status === "Confirmed").length;
    const lowStock = activeInventory.filter(p => p.stock < 5).length;
    
    // Mock Recovery Conversion
    const totalLeads = activeLeads.length + 5; // mock history
    const convertedLeads = 2; // mock converted
    const recoveryRate = Math.round((convertedLeads / totalLeads) * 100);

    return { revenue, activeOrders: activeOrdersCount, lowStock, recoveryRate };
  }, [activeOrders, activeInventory, activeLeads]);

  // ==========================================
  // INVENTORY DEDUCTION & CRM UPDATES LOGIC
  // ==========================================
  const handleConfirmOrderSlip = async (downloadPdf = false) => {
    if (!slipPhone.trim() || !slipName.trim()) {
      alert("Please fill in customer name and contact number.");
      return;
    }
    if (slipItems.length === 0) {
      alert("Please add at least one item to the order.");
      return;
    }

    // 1. Process or Create Customer in CRM (scoped to current workspace)
    let customerId = "";
    const existingCustomer = customers.find(c => c.phone === slipPhone.trim() && c.workspaceId === currentWorkspaceId);
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create new customer
      const newCustId = "C-" + Math.floor(206 + Math.random() * 800);
      const newCust: Customer = {
        id: newCustId,
        name: slipName.trim(),
        phone: slipPhone.trim(),
        address: slipAddress.trim(),
        district: slipDistrict,
        fraudFlag: false,
        returnRate: 0,
        blacklisted: false,
        workspaceId: currentWorkspaceId!
      };
      setCustomers(prev => [...prev, newCust]);
      customerId = newCustId;

      if (dbStatus === "synced") {
        try {
          await supabase.from("customers").insert([{
            id: newCust.id,
            name: newCust.name,
            phone: newCust.phone,
            address: newCust.address,
            district: newCust.district,
            fraud_flag: newCust.fraudFlag,
            return_rate: newCust.returnRate,
            blacklisted: newCust.blacklisted,
            workspace_id: newCust.workspaceId
          }]);
        } catch (err) {
          console.error("Supabase customer sync error:", err);
        }
      }
    }

    // 2. Calculate Pricing
    const subtotal = slipItems.reduce((sum, item) => {
      const prod = inventory.find(p => p.id === item.productId && p.workspaceId === currentWorkspaceId);
      return sum + (prod ? prod.price * item.quantity : 0);
    }, 0);
    const shipping = slipDistrict === "inside" ? shippingInside : shippingOutside;
    const total = subtotal + shipping - slipDiscount;

    // 3. Create Order
    const newOrderId = "TJ-" + Math.floor(1006 + Math.random() * 8000);
    const now = new Date();
    const dateStr = now.toISOString().replace("T", " ").substring(0, 16);

    const newOrder: Order = {
      id: newOrderId,
      date: dateStr,
      customerId,
      items: [...slipItems],
      subtotal,
      shipping,
      discount: slipDiscount,
      total,
      status: "Pending",
      tracking: "",
      courier: "None",
      workspaceId: currentWorkspaceId!
    };

    // 4. Update Inventory Stock (Decrement)
    setInventory(prev => {
      return prev.map(prod => {
        const ordered = slipItems.find(item => item.productId === prod.id && prod.workspaceId === currentWorkspaceId);
        if (ordered) {
          const newStock = prod.stock - ordered.quantity;
          return { ...prod, stock: newStock < 0 ? 0 : newStock };
        }
        return prod;
      });
    });

    // 5. Append Order
    setOrders(prev => [newOrder, ...prev]);

    // 6. Optional PDF Generation
    if (downloadPdf) {
      generateInvoicePdf(newOrder, slipName, slipPhone, slipAddress, slipDistrict, subtotal, shipping, total);
    }

    // 7. Reset Slip State & Close Modal
    setSlipPhone("");
    setSlipName("");
    setSlipAddress("");
    setSlipItems([]);
    setSlipDiscount(0);
    setSmartPasteText("");
    setIsCreateOrderOpen(false);
    triggerToast(`Order ${newOrderId} created successfully!`);

    if (dbStatus === "synced") {
      try {
        await supabase.from("orders").insert([{
          id: newOrder.id,
          date: newOrder.date,
          customer_id: newOrder.customerId,
          subtotal: newOrder.subtotal,
          shipping: newOrder.shipping,
          discount: newOrder.discount,
          total: newOrder.total,
          status: newOrder.status,
          tracking: newOrder.tracking,
          courier: newOrder.courier,
          workspace_id: newOrder.workspaceId,
          is_archived: false
        }]);

        const itemsToInsert = slipItems.map(item => ({
          order_id: newOrder.id,
          product_id: item.productId,
          quantity: item.quantity
        }));
        await supabase.from("order_items").insert(itemsToInsert);

        for (const item of slipItems) {
          const prod = inventory.find(p => p.id === item.productId && p.workspaceId === currentWorkspaceId);
          if (prod) {
            const newStock = Math.max(0, prod.stock - item.quantity);
            await supabase.from("products").update({ stock: newStock }).eq("id", prod.id);
          }
        }
      } catch (err) {
        console.error("Supabase order sync error:", err);
      }
    }
  };

  // ==========================================
  // ERP & CRM STATE MODIFY HANDLERS
  // ==========================================

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order["status"]) => {
    setOrders(prev => {
      return prev.map(o => {
        if (o.id === orderId) {
          return { ...o, status: newStatus };
        }
        return o;
      });
    });
    triggerToast(`Order ${orderId} status set to ${newStatus}`);

    if (dbStatus === "synced") {
      try {
        await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
      } catch (err) {
        console.error("Supabase order status sync error:", err);
      }
    }
  };

  const handleToggleCustomerBlacklist = async (customerId: string) => {
    setCustomers(prev => {
      return prev.map(c => {
        if (c.id === customerId) {
          const nextVal = !c.blacklisted;
          triggerToast(`Customer ${c.name} is now ${nextVal ? "BLACKLISTED" : "Whitelisted"}`);

          if (dbStatus === "synced") {
            supabase.from("customers").update({ blacklisted: nextVal, fraud_flag: nextVal }).eq("id", customerId).then();
          }

          return { ...c, blacklisted: nextVal, fraudFlag: nextVal };
        }
        return c;
      });
    });
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdId.trim() || !newProdName.trim()) {
      alert("Please enter product SKU and description name.");
      return;
    }
    const cleanId = newProdId.trim().toUpperCase();
    if (inventory.some(p => p.id.toLowerCase() === cleanId.toLowerCase() && p.workspaceId === currentWorkspaceId)) {
      alert("A product with this SKU already exists in this workspace!");
      return;
    }

    const newProduct: Product = {
      id: cleanId,
      name: newProdName.trim(),
      price: newProdPrice,
      cost: newProdCost,
      stock: newProdStock,
      category: newProdCategory,
      workspaceId: currentWorkspaceId!
    };

    setInventory(prev => [...prev, newProduct]);
    setIsAddProductOpen(false);

    // Reset Form
    setNewProdId("");
    setNewProdName("");
    setNewProdCategory("Rings");
    setNewProdCost(0);
    setNewProdPrice(0);
    setNewProdStock(0);

    triggerToast(`Product ${newProduct.id} added successfully!`);

    if (dbStatus === "synced") {
      try {
        await supabase.from("products").insert([{
          id: newProduct.id,
          name: newProduct.name,
          price: newProduct.price,
          cost: newProduct.cost,
          stock: newProduct.stock,
          category: newProduct.category,
          workspace_id: newProduct.workspaceId
        }]);
      } catch (err) {
        console.error("Supabase product sync error:", err);
      }
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!newProdName.trim()) {
      alert("Please enter a product description name.");
      return;
    }

    const updatedProduct: Product = {
      id: editingProduct.id,
      name: newProdName.trim(),
      price: newProdPrice,
      cost: newProdCost,
      stock: newProdStock,
      category: newProdCategory,
      workspaceId: editingProduct.workspaceId
    };

    setInventory(prev => prev.map(p => p.id === editingProduct.id ? updatedProduct : p));
    setEditingProduct(null);

    // Reset Form
    setNewProdId("");
    setNewProdName("");
    setNewProdCategory("Rings");
    setNewProdCost(0);
    setNewProdPrice(0);
    setNewProdStock(0);

    triggerToast(`Product ${updatedProduct.id} updated successfully!`);

    if (dbStatus === "synced") {
      try {
        await supabase.from("products").update({
          name: updatedProduct.name,
          price: updatedProduct.price,
          cost: updatedProduct.cost,
          stock: updatedProduct.stock,
          category: updatedProduct.category
        }).eq("id", updatedProduct.id);
      } catch (err) {
        console.error("Supabase product update sync error:", err);
      }
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (confirm(`Are you sure you want to permanently delete product "${productId}"?`)) {
      // Check if product is referenced in any active order items or orders
      const isReferenced = orders.some(o => o.items.some(item => item.productId === productId));
      if (isReferenced) {
        alert("Cannot delete product: This product is referenced in existing order slips and cannot be removed.");
        return;
      }

      setInventory(prev => prev.filter(p => p.id !== productId));
      triggerToast(`Product "${productId}" deleted.`);

      if (dbStatus === "synced") {
        try {
          const { error } = await supabase.from("products").delete().eq("id", productId);
          if (error) {
            console.error("Supabase product delete sync error:", error);
            alert(`Supabase Error: ${error.message}`);
          }
        } catch (err) {
          console.error("Supabase product delete error:", err);
        }
      }
    }
  };

  // ==========================================
  // BULK COURIER EXPORTER LOGIC
  // ==========================================
  const handleBulkExport = () => {
    if (selectedOrderIds.length === 0) {
      alert("Select at least one order to export.");
      return;
    }

    // Assign Tracking & Courier details to the selected orders
    const trackingMap: { [orderId: string]: string } = {};
    selectedOrderIds.forEach(id => {
      const randTrack = Math.floor(100000 + Math.random() * 900000);
      trackingMap[id] = `${bulkCourier.substring(0, 2).toUpperCase()}-${randTrack}`;
    });

    setOrders(prev => {
      return prev.map(order => {
        if (selectedOrderIds.includes(order.id)) {
          return {
            ...order,
            status: "Dispatched",
            courier: bulkCourier,
            tracking: trackingMap[order.id]
          };
        }
        return order;
      });
    });

    if (dbStatus === "synced") {
      selectedOrderIds.forEach(id => {
        supabase.from("orders").update({
          status: "Dispatched",
          courier: bulkCourier,
          tracking: trackingMap[id]
        }).eq("id", id).then(({ error }) => {
          if (error) console.error("Supabase bulk export status update error:", error);
        });
      });
    }

    // Generate CSV mockup
    let csvContent = "";
    if (bulkCourier === "Steadfast") {
      csvContent = "Customer Name,Phone,Address,COD Amount,Note\n";
    } else if (bulkCourier === "Pathao") {
      csvContent = "recipient_name,recipient_phone,recipient_address,cod_amount,item_quantity\n";
    } else {
      csvContent = "Name,Mobile,Delivery_Address,Price,Tracking_Ref\n";
    }

    selectedOrderIds.forEach(id => {
      const order = orders.find(o => o.id === id);
      const cust = customers.find(c => c.id === order?.customerId);
      if (order && cust) {
        if (bulkCourier === "Steadfast") {
          csvContent += `"${cust.name}","${cust.phone}","${cust.address}",${order.total},"Jewelry Package"\n`;
        } else if (bulkCourier === "Pathao") {
          csvContent += `"${cust.name}","${cust.phone}","${cust.address}",${order.total},${order.items.length}\n`;
        } else {
          csvContent += `"${cust.name}","${cust.phone}","${cust.address}",${order.total},"${order.id}"\n`;
        }
      }
    });

    // Clipboard copy mock
    navigator.clipboard.writeText(csvContent);
    triggerToast(`Bulk CSV for ${bulkCourier} copied to clipboard! (${selectedOrderIds.length} orders)`);
    setSelectedOrderIds([]);
  };

  const handleArchiveOrder = async (orderId: string, archive: boolean) => {
    setOrders(prev =>
      prev.map(o => (o.id === orderId ? { ...o, isArchived: archive } : o))
    );
    triggerToast(archive ? "Order archived successfully." : "Order unarchived successfully.");

    if (dbStatus === "synced") {
      try {
        await supabase.from("orders").update({ is_archived: archive }).eq("id", orderId);
      } catch (err) {
        console.error("Supabase archive order error:", err);
      }
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (confirm("Are you sure you want to permanently delete this order?")) {
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
      triggerToast("Order permanently deleted.");

      if (dbStatus === "synced") {
        try {
          await supabase.from("orders").delete().eq("id", orderId);
        } catch (err) {
          console.error("Supabase delete order error:", err);
        }
      }
    }
  };

  // ==========================================
  // INLINE ERP INVENTORY STOCK SAVER
  // ==========================================
  const handleStockUpdate = async (id: string, field: "stock" | "price" | "cost", val: number) => {
    setInventory(prev => {
      return prev.map(prod => {
        if (prod.id === id) {
          return { ...prod, [field]: val };
        }
        return prod;
      });
    });

    if (dbStatus === "synced") {
      try {
        await supabase.from("products").update({ [field]: val }).eq("id", id);
      } catch (err) {
        console.error("Supabase stock update error:", err);
      }
    }
  };

  // ==========================================
  // WHATSAPP URL RECOVERY LINK GENERATOR
  // ==========================================
  const getWhatsAppRecoveryLink = (lead: Lead) => {
    const text = `Hello ${lead.name}, this is ${shopName}. We saw you were asking about *${lead.items}* totaling *${lead.value} Tk* in our DMs. Would you like us to confirm this order for you? Please reply with your shipping address. Thanks! ❤️`;
    const encodedText = encodeURIComponent(text);
    return `https://wa.me/88${lead.phone}?text=${encodedText}`;
  };

  // ==========================================
  // INVOICE COPY TEMPLATE FORMATTER
  // ==========================================
  const handleCopyInvoiceText = (order: Order, cust: Customer) => {
    const ws = workspaces.find(w => w.id === order.workspaceId);
    const wsName = (ws?.name || "Terminus").toUpperCase();
    const wsNiche = ws?.niche || "Jewelry";

    const itemsFormatted = order.items.map(item => {
      const prod = inventory.find(p => p.id === item.productId);
      return `${prod ? prod.name : "Item"} x ${item.quantity}`;
    }).join(", ");

    const districtFormatted = order.shipping === shippingInside ? "Inside Dhaka" : "Outside Dhaka";
    const discountLine = order.discount > 0 ? `Discount: -${order.discount} Tk\n` : "";

    const text = `✨ ${wsName} - Order Invoice ✨
-----------------------------------
Items: ${itemsFormatted}
Delivery Location: ${districtFormatted}
${discountLine}Total Amount Payable: ${order.total} Tk (Cash on Delivery)

Shipping Details:
Name: ${cust.name}
Contact: ${cust.phone}
Address: ${cust.address}

*Please verify your details above. Your ${wsNiche.toLowerCase()} parcel will be shipped within 24 hours! Thank you for shopping with us.* ❤️

Powered by Terminus™`;

    navigator.clipboard.writeText(text);
    setCopiedInvoiceId(order.id);
    setTimeout(() => setCopiedInvoiceId(null), 2000);
  };

  // ==========================================
  // PDF GENERATOR UTILITY (JSPDF)
  // ==========================================
  const generateInvoicePdf = (
    order: Order,
    name: string,
    phone: string,
    address: string,
    district: "inside" | "outside",
    subtotal: number,
    shipping: number,
    total: number
  ) => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const primaryColor = [24, 24, 27]; 
      const mutedColor = [113, 113, 122]; 

      // Header
      const ws = workspaces.find(w => w.id === order.workspaceId);
      const wsName = (ws?.name || "TERMINUS").toUpperCase();
      const wsNiche = ws?.niche || "Jewelry";

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(wsName, 15, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.text(`E-Commerce CRM & ERP (${wsNiche} Workspace)`, 15, 25);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("INVOICE", 195, 20, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Ref ID: #${order.id}`, 195, 25, { align: "right" });
      doc.text(`Date: ${order.date}`, 195, 30, { align: "right" });

      doc.setDrawColor(228, 228, 231);
      doc.setLineWidth(0.5);
      doc.line(15, 35, 195, 35);

      // Customer
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("BILL TO:", 15, 45);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`Name: ${name}`, 15, 50);
      doc.text(`Contact: ${phone}`, 15, 55);
      doc.text(`Location: ${district === "inside" ? "Inside Dhaka" : "Outside Dhaka"}`, 15, 60);

      doc.text("Address:", 15, 65);
      const splitAddress = doc.splitTextToSize(address || "N/A", 120);
      doc.text(splitAddress, 32, 65);

      const addressLinesCount = splitAddress.length;
      let startTableY = 65 + (addressLinesCount * 4.5) + 8;
      if (startTableY < 80) startTableY = 80;

      // Table Headers
      doc.setFillColor(244, 244, 245);
      doc.rect(15, startTableY, 180, 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("Product Description", 18, startTableY + 5.5);
      doc.text("Price (Tk)", 125, startTableY + 5.5, { align: "right" });
      doc.text("Qty", 155, startTableY + 5.5, { align: "center" });
      doc.text("Total (Tk)", 192, startTableY + 5.5, { align: "right" });

      // Table body
      let currentY = startTableY + 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);

      order.items.forEach(item => {
        const prod = inventory.find(p => p.id === item.productId);
        doc.setDrawColor(244, 244, 245);
        doc.line(15, currentY + 8, 195, currentY + 8);

        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(prod ? prod.name : "Unknown Item", 18, currentY + 5.5);
        doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
        doc.text(`${prod ? prod.price : 0} Tk`, 125, currentY + 5.5, { align: "right" });
        doc.text(`${item.quantity}`, 155, currentY + 5.5, { align: "center" });
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        const lineTotal = (prod ? prod.price : 0) * item.quantity;
        doc.text(`${lineTotal} Tk`, 192, currentY + 5.5, { align: "right" });

        currentY += 8;
      });

      // Calculations block
      currentY += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.text("Items Subtotal:", 140, currentY, { align: "right" });
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`${subtotal} Tk`, 192, currentY, { align: "right" });

      currentY += 6;
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.text(`Shipping Fee:`, 140, currentY, { align: "right" });
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`+${shipping} Tk`, 192, currentY, { align: "right" });

      if (order.discount > 0) {
        currentY += 6;
        doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
        doc.text("Discount:", 140, currentY, { align: "right" });
        doc.setTextColor(239, 68, 68);
        doc.text(`-${order.discount} Tk`, 192, currentY, { align: "right" });
      }

      currentY += 8;
      doc.setFillColor(24, 24, 27);
      doc.rect(110, currentY - 5, 85, 9, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text("Total COD Amount Payable:", 114, currentY + 1);
      doc.setTextColor(52, 211, 153);
      doc.text(`${total} Tk`, 192, currentY + 1, { align: "right" });

      // Footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.text("Please verify your name, contact, and delivery details on receipt.", 105, 268, { align: "center" });
      
      doc.setFont("helvetica", "oblique");
      doc.setFontSize(7.5);
      doc.text(`Your ${wsNiche.toLowerCase()} parcel will be shipped within 24 hours. Thank you!`, 105, 273, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(mutedColor[0], mutedColor[1], mutedColor[2]);
      doc.text("Powered by Terminus™", 105, 279, { align: "center" });

      doc.save(`invoice-${order.id}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper utils
  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // ==========================================
  // CRM CUSTOMER STATISTICS COMPUTATION
  // ==========================================
  const customerStatsMap = useMemo(() => {
    const stats: Record<string, { ltv: number; returns: number; count: number; avgOrder: number }> = {};
    
    activeCustomers.forEach(c => {
      stats[c.id] = { ltv: 0, returns: 0, count: 0, avgOrder: 0 };
    });

    activeOrders.forEach(o => {
      if (!stats[o.customerId]) {
        stats[o.customerId] = { ltv: 0, returns: 0, count: 0, avgOrder: 0 };
      }
      stats[o.customerId].count += 1;
      if (o.status === "Returned") {
        stats[o.customerId].returns += 1;
      } else if (o.status !== "Pending") {
        stats[o.customerId].ltv += o.total;
      }
    });

    activeCustomers.forEach(c => {
      const s = stats[c.id];
      if (s && s.count > 0) {
        s.avgOrder = Math.round(s.ltv / (s.count - s.returns || 1));
      }
    });

    return stats;
  }, [activeCustomers, activeOrders]);

  // ==========================================
  // CREATE ORDER SLIP ITEMS MANAGER
  // ==========================================
  const handleAddSlipItem = () => {
    const prod = activeInventory.find(p => p.id === slipSelectedProductId);
    if (!prod) return;
    if (prod.stock <= 0) {
      alert("This product is currently out of stock!");
      return;
    }

    setSlipItems(prev => {
      const exist = prev.find(item => item.productId === prod.id);
      if (exist) {
        if (exist.quantity >= prod.stock) {
          alert(`Cannot add more. Only ${prod.stock} units available in inventory.`);
          return prev;
        }
        return prev.map(item =>
          item.productId === prod.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { productId: prod.id, quantity: 1 }];
    });
  };

  const handleUpdateSlipItemQuantity = (productId: string, delta: number) => {
    const prod = activeInventory.find(p => p.id === productId);
    if (!prod) return;

    setSlipItems(prev => {
      return prev.map(item => {
        if (item.productId === productId) {
          const nextQty = item.quantity + delta;
          if (nextQty > prod.stock) {
            alert(`Stock limit reached. Only ${prod.stock} units available.`);
            return item;
          }
          return { ...item, quantity: nextQty < 1 ? 1 : nextQty };
        }
        return item;
      });
    });
  };

  // Filtered selections
  const filteredOrders = useMemo(() => {
    return activeOrders.filter(o => {
      const cust = activeCustomers.find(c => c.id === o.customerId);
      const matchesSearch =
        o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
        cust?.name.toLowerCase().includes(orderSearch.toLowerCase()) ||
        cust?.phone.includes(orderSearch);
      
      if (orderStatusFilter === "Archived") {
        return matchesSearch && o.isArchived === true;
      } else {
        const matchesStatus = orderStatusFilter === "All" || o.status === orderStatusFilter;
        return matchesSearch && !o.isArchived && matchesStatus;
      }
    });
  }, [activeOrders, activeCustomers, orderSearch, orderStatusFilter]);

  const filteredCustomers = useMemo(() => {
    return activeCustomers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch) ||
      c.address.toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [activeCustomers, customerSearch]);

  const filteredStock = useMemo(() => {
    return activeInventory.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(stockSearch.toLowerCase()) || p.id.toLowerCase().includes(stockSearch.toLowerCase());
      const matchesCat = stockCategoryFilter === "All" || p.category === stockCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [activeInventory, stockSearch, stockCategoryFilter]);

  // 1. Loading state to prevent shift
  if (isAuthenticated === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-550 font-sans antialiased">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <span className="text-xs text-zinc-500 font-mono tracking-wider">SECURE LINK ESTABLISHING...</span>
        </div>
      </div>
    );
  }

  // 2. Gateway Auth Gate Screen
  if (isAuthenticated === false) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-50 font-sans antialiased selection:bg-purple-500/20 selection:text-purple-300 relative">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-sm border border-zinc-850 bg-zinc-900/60 backdrop-blur-md p-6 rounded-xl shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="h-10 w-10 rounded bg-purple-655 flex items-center justify-center text-zinc-950 font-bold font-mono text-lg shadow-[0_0_20px_rgba(147,51,234,0.35)] animate-pulse">
              T
            </div>
            <h1 className="text-md font-bold uppercase tracking-wider text-white font-mono mt-1">TERMINUS GATEWAY</h1>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold font-mono">Administrative Access Required</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-zinc-550 font-semibold uppercase tracking-wider font-mono">Username</label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="masteryousha"
                className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-2 text-zinc-150 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-zinc-550 font-semibold uppercase tracking-wider font-mono">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-2 text-zinc-150 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
              />
            </div>

            {loginError && (
              <div className="p-2.5 bg-rose-950/20 border border-rose-500/20 text-rose-455 text-[10px] rounded font-semibold text-center flex items-center justify-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-purple-650 hover:bg-purple-550 text-white font-bold font-mono py-2 rounded text-xs transition-all shadow-md active:scale-[0.98] mt-2 uppercase tracking-wider"
            >
              Authorize Session
            </button>
          </form>
          
          <div className="text-center text-[9px] text-zinc-650 font-mono mt-1 uppercase">
            Secured Local Mock State // Supabase Ready
          </div>
        </div>
      </div>
    );
  }

  // 3. Workspace Selector Hub Screen
  if (currentWorkspaceId === null) {
    return (
      <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-50 font-sans antialiased selection:bg-purple-500/20 selection:text-purple-300 overflow-y-auto p-8 relative">
        <div className="absolute top-10 left-10 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-purple-500/5 blur-[100px] pointer-events-none" />
        
        {/* Hub Header */}
        <div className="max-w-4xl w-full mx-auto flex items-center justify-between border-b border-zinc-900 pb-6 mb-8 mt-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-purple-650 flex items-center justify-center text-zinc-955 font-bold font-mono text-xs shadow-sm">
                T
              </div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-white font-mono">TERMINUS HUB</h2>
            </div>
            <p className="text-xs text-zinc-500 mt-1">Select a business tenant workspace or register a new one to access operational ERP/CRM systems.</p>
          </div>
          <div className="flex items-center gap-3.5">
            {/* DB CONNECTION STATUS SYNC LIGHT */}
            <div className="flex items-center gap-1.5 text-[9px] font-mono border border-zinc-900 px-2 py-0.5 rounded bg-zinc-950/60 select-none">
              <span className={`h-1.5 w-1.5 rounded-full ${
                dbStatus === "synced"
                  ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                  : dbStatus === "connecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-zinc-650"
              }`} />
              <span className={dbStatus === "synced" ? "text-emerald-400 font-bold" : "text-zinc-500"}>
                {dbStatus === "synced" ? "SUPABASE SYNCED" : dbStatus === "connecting" ? "SYNCING..." : "LOCAL ENGINE"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-semibold font-mono text-zinc-400 hover:text-zinc-200 border border-zinc-850 px-3 py-1.5 rounded bg-zinc-900/40 hover:bg-zinc-900 transition-all shadow-sm"
            >
              Log Out Session
            </button>
          </div>
        </div>

        {/* Directory Grid */}
        <div className="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-3 gap-5">
          {allowedWorkspaces.length === 0 ? (
            <div className="col-span-full bg-zinc-900/20 border border-zinc-900 p-10 rounded-xl text-center flex flex-col items-center justify-center gap-3">
              <Lock className="h-8 w-8 text-zinc-650" />
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono">No Assigned Workspaces</h3>
              <p className="text-[10px] text-zinc-500 max-w-xs leading-relaxed">
                Your operator account is active but has not been assigned to any business workspaces yet. Please contact a system administrator.
              </p>
            </div>
          ) : (
            allowedWorkspaces.map(ws => {
              const wsInventoryCount = inventory.filter(p => p.workspaceId === ws.id).length;
              const wsOrdersCount = orders.filter(o => o.workspaceId === ws.id).length;
              
              return (
                <div
                  key={ws.id}
                  onClick={() => {
                    setCurrentWorkspaceId(ws.id);
                    localStorage.setItem("terminus_active_workspace_id", ws.id);
                    triggerToast(`Loaded "${ws.name}"`);
                  }}
                  className="bg-zinc-900/40 border border-zinc-900 hover:border-purple-500/40 p-5 rounded-xl flex flex-col justify-between gap-6 cursor-pointer hover:bg-zinc-900/60 shadow-sm transition-all group active:scale-[0.99] relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-[80px] h-[80px] rounded-full bg-purple-500/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex flex-col gap-1.5 relative">
                    <span className="text-[10px] text-purple-400 font-bold font-mono uppercase tracking-wider">{ws.niche}</span>
                    <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">{ws.name}</h3>
                    <p className="text-[10px] text-zinc-550 font-mono">ID: {ws.id} // Currency: {ws.currency}</p>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-zinc-900/60 pt-3 relative text-[10px] font-mono text-zinc-400">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-zinc-650 uppercase font-semibold text-[9px]">Products</span>
                      <span className="text-zinc-300 font-semibold">{wsInventoryCount}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-zinc-650 uppercase font-semibold text-[9px]">Orders</span>
                      <span className="text-zinc-300 font-semibold">{wsOrdersCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-purple-400 font-bold uppercase text-[9px] opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      Open ➜
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* New Workspace Creation Card */}
          {sessionUser?.role === "Admin" && (
            <div
              onClick={() => setIsWorkspaceCreateOpen(true)}
              className="border-2 border-dashed border-zinc-850 hover:border-purple-500/40 p-5 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-zinc-900/20 shadow-sm transition-all text-center group min-h-[150px]"
            >
              <Plus className="h-6 w-6 text-zinc-500 group-hover:text-purple-400 transition-colors" />
              <span className="text-xs font-semibold text-zinc-400 group-hover:text-zinc-200 font-mono">Create Business Workspace</span>
              <span className="text-[9px] text-zinc-600 uppercase font-semibold tracking-wider font-mono">Deploy Isolated Tenant</span>
            </div>
          )}
        </div>

        {/* Modal: Create Workspace */}
        {isWorkspaceCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                <h3 className="text-xs font-bold text-white font-mono uppercase">Register Workspace</h3>
                <button
                  type="button"
                  onClick={() => setIsWorkspaceCreateOpen(false)}
                  className="text-zinc-550 hover:text-zinc-300 text-xs"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateWorkspace} className="p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider font-mono">Business Name</label>
                  <input
                    type="text"
                    required
                    value={newWsName}
                    onChange={e => setNewWsName(e.target.value)}
                    placeholder="e.g. Aura Cosmetics"
                    className="w-full bg-zinc-950 text-xs border border-zinc-850 rounded px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-550 font-semibold uppercase tracking-wider font-mono">Niche / Industry</label>
                  <select
                    value={newWsNiche}
                    onChange={e => setNewWsNiche(e.target.value)}
                    className="w-full bg-zinc-950 text-xs border border-zinc-850 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="Jewelry">Jewelry & Accessories</option>
                    <option value="Cosmetics">Cosmetics & Beauty</option>
                    <option value="Apparel">Fashion & Clothing</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Other">Other Retail Niche</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-550 font-semibold uppercase tracking-wider font-mono">Base Currency</label>
                  <select
                    value={newWsCurrency}
                    onChange={e => setNewWsCurrency(e.target.value)}
                    className="w-full bg-zinc-950 text-xs border border-zinc-850 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="Tk">BDT (Tk)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-purple-650 hover:bg-purple-550 text-white font-bold py-2 rounded text-xs font-mono transition-all uppercase tracking-wider shadow"
                >
                  Create & Initialize
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Main Workspace Dashboard Layout (normal return)
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-50 font-sans antialiased selection:bg-purple-500/20 selection:text-purple-300">
      
      {/* SUCCESS TOAST POPUP */}
      {successToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-zinc-900 border border-emerald-500/30 text-emerald-400 text-xs px-3.5 py-2.5 rounded-md shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Check className="h-4 w-4 shrink-0" />
          <span className="font-medium">{successToast}</span>
        </div>
      )}

      {/* LEFT NAVIGATION MENU (FIXED SIDEBAR) */}
      <aside className="w-56 bg-zinc-950 border-r border-zinc-900 flex flex-col shrink-0">
        
        {/* Workspace Dropdown Switcher Header */}
        <div className="p-3 border-b border-zinc-900/60 relative">
          <button
            type="button"
            onClick={() => setIsWsDropdownOpen(!isWsDropdownOpen)}
            className="w-full flex items-center justify-between gap-1.5 bg-zinc-900/30 hover:bg-zinc-900/70 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-left transition-all"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-6 w-6 rounded bg-purple-650 flex items-center justify-center text-zinc-955 font-bold font-mono text-xs shrink-0 shadow-sm">
                {activeWorkspace?.name.charAt(0) || "T"}
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-[11px] font-bold text-white truncate font-sans">{activeWorkspace?.name || "Terminus"}</span>
                <span className="text-[8px] text-zinc-500 font-semibold uppercase tracking-wider font-mono truncate">{activeWorkspace?.niche || "Niche"}</span>
              </div>
            </div>
            <span className="text-zinc-500 text-[10px] shrink-0">▼</span>
          </button>

          {/* Switcher Dropdown Menu */}
          {isWsDropdownOpen && (
            <div className="absolute top-full left-3 right-3 z-50 mt-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 p-1 flex flex-col gap-0.5">
              <div className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold font-mono px-2 py-1 select-none">
                Switch Business
              </div>
               {allowedWorkspaces.map(ws => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    setCurrentWorkspaceId(ws.id);
                    localStorage.setItem("terminus_active_workspace_id", ws.id);
                    setIsWsDropdownOpen(false);
                    triggerToast(`Swapped to ${ws.name}`);
                  }}
                  className={`w-full flex items-center justify-between text-left text-xs px-2.5 py-1.5 rounded transition-colors ${
                    ws.id === currentWorkspaceId
                      ? "bg-purple-950/20 text-purple-400 border border-purple-500/20"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
                  }`}
                >
                  <span className="font-semibold truncate text-[11px]">{ws.name}</span>
                  <span className="text-[8px] text-zinc-650 font-mono shrink-0 font-semibold">{ws.id}</span>
                </button>
              ))}

              <div className="border-t border-zinc-850/80 my-1" />

              <button
                type="button"
                onClick={() => {
                  setCurrentWorkspaceId(null);
                  localStorage.removeItem("terminus_active_workspace_id");
                  setIsWsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-1.5 text-left text-xs text-zinc-355 hover:text-white hover:bg-zinc-800/40 px-2.5 py-1.5 rounded transition-colors font-mono"
              >
                <span>🏢 Hub Directory</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsWsDropdownOpen(false);
                  setCurrentWorkspaceId(null);
                  localStorage.removeItem("terminus_active_workspace_id");
                  setIsWorkspaceCreateOpen(true);
                }}
                className="w-full flex items-center gap-1.5 text-left text-xs text-purple-450 hover:text-purple-305 hover:bg-zinc-800/40 px-2.5 py-1.5 rounded transition-colors font-mono"
              >
                <span>➕ Create Business</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-1.5 text-left text-xs text-rose-455 hover:text-rose-400 hover:bg-zinc-800/40 px-2.5 py-1.5 rounded transition-colors font-mono"
              >
                <span>🚪 Log Out</span>
              </button>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              activeTab === "dashboard"
                ? "bg-zinc-900 text-white border border-zinc-800 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard Overview</span>
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              activeTab === "orders"
                ? "bg-zinc-900 text-white border border-zinc-800 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Orders Slip Engine</span>
          </button>

          <button
            onClick={() => setActiveTab("customers")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              activeTab === "customers"
                ? "bg-zinc-900 text-white border border-zinc-800 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Customers (CRM)</span>
          </button>

          <button
            onClick={() => setActiveTab("stock")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              activeTab === "stock"
                ? "bg-zinc-900 text-white border border-zinc-800 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>Stock Manager (ERP)</span>
          </button>

          <button
            onClick={() => setActiveTab("recovery")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              activeTab === "recovery"
                ? "bg-zinc-900 text-white border border-zinc-800 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Recovery Hub</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              activeTab === "settings"
                ? "bg-zinc-900 text-white border border-zinc-800 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
            }`}
          >
            <SettingsIcon className="h-4 w-4" />
            <span>Settings</span>
          </button>

          {sessionUser?.role === "Admin" && (
            <button
              onClick={() => setActiveTab("accounts")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                activeTab === "accounts"
                  ? "bg-zinc-900 text-white border border-zinc-800 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40"
              }`}
            >
              <Fingerprint className="h-4 w-4 text-purple-400" />
              <span>Account Management</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-zinc-900 text-[10px] text-zinc-600 font-mono flex flex-col gap-1 bg-zinc-950/80">
          <span>Active: {shopName}</span>
          <span>COD Mode enabled</span>
        </div>
      </aside>

      {/* MAIN VIEW CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950 overflow-hidden">
        
        {/* HEADER BAR */}
        <header className="h-14 border-b border-zinc-900 flex items-center justify-between px-6 bg-zinc-950/40 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 font-mono capitalize">Navigation /</span>
            <span className="text-xs text-zinc-200 font-medium capitalize font-mono">{activeTab}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* DB CONNECTION STATUS SYNC LIGHT */}
            <div className="flex items-center gap-1.5 text-[9px] font-mono border border-zinc-900 px-2 py-0.5 rounded bg-zinc-950/60 select-none">
              <span className={`h-1.5 w-1.5 rounded-full ${
                dbStatus === "synced"
                  ? "bg-emerald-500 shadow-[0_0_8px_#10b981]"
                  : dbStatus === "connecting"
                  ? "bg-amber-500 animate-pulse"
                  : "bg-zinc-650"
              }`} />
              <span className={dbStatus === "synced" ? "text-emerald-400 font-bold" : "text-zinc-500"}>
                {dbStatus === "synced" ? "SUPABASE SYNCED" : dbStatus === "connecting" ? "SYNCING..." : "LOCAL ENGINE"}
              </span>
            </div>
            <div className="text-xs text-zinc-500 font-mono">BDT (Tk) Currency</div>
            <div className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-semibold text-zinc-300">
              AD
            </div>
          </div>
        </header>

        {/* TAB WORKSPACES */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* ==========================================
              1. DASHBOARD TAB VIEW
              ========================================== */}
          {activeTab === "dashboard" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              
              {/* TOP ROW METRICS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/40 border border-zinc-900 p-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Today's Revenue</span>
                    <span className="text-2xl font-bold text-zinc-50 font-mono">{metrics.revenue} Tk</span>
                    <span className="text-[9px] text-emerald-400 font-medium flex items-center gap-0.5">
                      <TrendingUp className="h-3 w-3" /> +12.4% from yesterday
                    </span>
                  </div>
                  <div className="h-10 w-10 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-900 p-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Active Orders</span>
                    <span className="text-2xl font-bold text-zinc-50 font-mono">{metrics.activeOrders}</span>
                    <span className="text-[9px] text-zinc-500 font-medium">Pending & Confirmed slips</span>
                  </div>
                  <div className="h-10 w-10 bg-zinc-800 rounded-lg border border-zinc-700 flex items-center justify-center text-zinc-300 shrink-0">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-900 p-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Low Stock Alerts</span>
                    <span className="text-2xl font-bold text-rose-500 font-mono">{metrics.lowStock} Items</span>
                    <span className="text-[9px] text-rose-400/80 font-medium flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" /> Threshold set below 5
                    </span>
                  </div>
                  <div className="h-10 w-10 bg-rose-500/10 rounded-lg border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                    <Boxes className="h-5 w-5" />
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-900 p-4 rounded-xl flex items-center justify-between shadow-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Recovery Conversion</span>
                    <span className="text-2xl font-bold text-purple-400 font-mono">{metrics.recoveryRate}%</span>
                    <span className="text-[9px] text-purple-300 font-medium flex items-center gap-0.5">
                      <UserCheck className="h-3 w-3" /> WhatsApp link recovery active
                    </span>
                  </div>
                  <div className="h-10 w-10 bg-purple-500/10 rounded-lg border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {/* CENTER TREND CHART & RIGHT DM LEADS PANEL */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 7-DAY SALES TREND AREA CHART */}
                <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="text-sm font-semibold text-white">7-Day Sales Trend</h3>
                      <p className="text-[11px] text-zinc-500">Live analytics dashboard of {activeWorkspace?.name || "Jewelry"} order transactions ({activeWorkspace?.currency || "Tk"})</p>
                    </div>
                    <div className="text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-1 rounded">
                      Total: {activeOrders.reduce((sum, o) => sum + o.total, 0)} {activeWorkspace?.currency || "Tk"}
                    </div>
                  </div>

                  {/* SVG custom area chart */}
                  <div className="h-56 w-full mt-2 relative">
                    <svg viewBox="0 0 500 200" className="w-full h-full">
                      <defs>
                        <linearGradient id="emerald-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      {/* Grid Lines */}
                      <line x1="0" y1="50" x2="500" y2="50" stroke="#1f1f23" strokeDasharray="3,3" />
                      <line x1="0" y1="100" x2="500" y2="100" stroke="#1f1f23" strokeDasharray="3,3" />
                      <line x1="0" y1="150" x2="500" y2="150" stroke="#1f1f23" strokeDasharray="3,3" />
                      
                      {/* Trend Area */}
                      {salesTrendData.areaPath && (
                        <path
                          d={salesTrendData.areaPath}
                          fill="url(#emerald-grad)"
                        />
                      )}
                      {/* Trend Line */}
                      {salesTrendData.linePath && (
                        <path
                          d={salesTrendData.linePath}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      )}
                      
                      {/* Data nodes */}
                      {salesTrendData.points.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r="4"
                          fill="#10b981"
                          stroke="#09090b"
                          strokeWidth="1.5"
                          className="transition-all duration-300 hover:scale-150 cursor-pointer"
                        >
                          <title>{`${salesTrendData.labels[idx]}: ${salesTrendData.values[idx]} ${activeWorkspace?.currency || "Tk"}`}</title>
                        </circle>
                      ))}
                    </svg>
 
                     {/* X-Axis labels */}
                     <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-2 px-1">
                       {salesTrendData.labels.map((lbl, idx) => (
                         <span key={idx} className="w-[70px] text-center first:text-left last:text-right">
                           {lbl}
                         </span>
                       ))}
                     </div>
                   </div>
                 </div>
 
                 {/* LIVE DMS / CLIENT LEADS FEED */}
                 <div className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                   <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                     <div className="flex flex-col gap-0.5">
                       <h3 className="text-sm font-semibold text-white">Live leads Feed</h3>
                       <p className="text-[11px] text-zinc-500">Facebook DM / Messenger Sync</p>
                     </div>
                     <span className="text-[9px] font-mono bg-red-950/20 text-red-500 border border-red-900/30 px-2.5 py-0.5 rounded-full font-bold">INOP</span>
                   </div>

                  <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {MOCK_DMS.map((dm, idx) => (
                      <div key={idx} className="flex gap-2.5 items-start bg-zinc-950/50 p-2.5 rounded border border-zinc-900/80 hover:bg-zinc-900/30 transition-colors">
                        <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-400 shrink-0 uppercase border border-zinc-700">
                          {dm.sender.substring(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-zinc-300">{dm.sender}</span>
                            <span className="text-[9px] text-zinc-600 font-mono">{dm.time}</span>
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate leading-snug">
                            {dm.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==========================================
              2. ORDERS TAB VIEW (PRIMARY GRID)
              ========================================== */}
          {activeTab === "orders" && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              
              {/* FILTERS & SEARCH ROW */}
              <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base font-semibold text-white">Orders Processing Engine</h2>
                  <p className="text-xs text-zinc-500">Search customer orders, print invoice slips, and sync bulk courier CSV exports.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSlipPhone("");
                      setSlipName("");
                      setSlipAddress("");
                      setSlipItems([]);
                      setIsCreateOrderOpen(true);
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all"
                  >
                    <Plus className="h-4 w-4" /> Create New Order
                  </button>
                </div>
              </div>

              {/* SEARCH FILTERS CARD */}
              <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
                
                {/* Search query input */}
                <div className="w-full md:w-80 relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-650" />
                  <input
                    type="text"
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                    placeholder="Search by customer name, phone, or order ID..."
                    className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded px-8 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/80 transition-all"
                  />
                </div>

                {/* Status selector tabs */}
                <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-900 self-stretch md:self-auto overflow-x-auto">
                  {["All", "Pending", "Confirmed", "Dispatched", "Delivered", "Returned", "Archived"].map(st => (
                    <button
                      key={st}
                      onClick={() => setOrderStatusFilter(st)}
                      className={`px-3 py-1 text-[10px] font-semibold rounded uppercase tracking-wider transition-colors ${
                        orderStatusFilter === st
                          ? "bg-zinc-850 text-white border border-zinc-700 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* COURIER BULK EXPORTER PANEL */}
              {selectedOrderIds.length > 0 && (
                <div className="bg-purple-950/15 border border-purple-500/20 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-[0_0_12px_rgba(139,92,246,0.02)] animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-950/40 text-purple-400 border border-purple-800/30 flex items-center justify-center">
                      <Truck className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-white">Bulk Courier Dispatcher</span>
                      <span className="text-[10px] text-purple-400/90">{selectedOrderIds.length} orders selected. Ready to compile spreadsheet export.</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <select
                      value={bulkCourier}
                      onChange={e => setBulkCourier(e.target.value as any)}
                      className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="Steadfast">Steadfast CSV Template</option>
                      <option value="Pathao">Pathao CSV Template</option>
                      <option value="RedX">RedX CSV Template</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleBulkExport}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export Bulk
                    </button>
                  </div>
                </div>
              )}

              {/* MAIN DATA GRID TABLE */}
              <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[10px] text-zinc-500 font-semibold bg-zinc-900/50 uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedOrderIds(filteredOrders.map(o => o.id));
                            } else {
                              setSelectedOrderIds([]);
                            }
                          }}
                          className="rounded border-zinc-800 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-3.5 px-2">Order ID</th>
                      <th className="py-3.5 px-3">Date</th>
                      <th className="py-3.5 px-3">Customer Details</th>
                      <th className="py-3.5 px-3 text-right">COD Total</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-3">Courier Logistics</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-zinc-600 font-mono">No matching orders found.</td>
                      </tr>
                    ) : (
                      filteredOrders.map(order => {
                        const cust = customers.find(c => c.id === order.customerId);
                        const isChecked = selectedOrderIds.includes(order.id);

                        return (
                          <tr key={order.id} className="border-b border-zinc-900/50 hover:bg-zinc-900/20 transition-colors">
                            <td className="py-3 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedOrderIds(prev => [...prev, order.id]);
                                  } else {
                                    setSelectedOrderIds(prev => prev.filter(id => id !== order.id));
                                  }
                                }}
                                className="rounded border-zinc-800 text-emerald-500 focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-2 font-mono font-semibold text-zinc-200">{order.id}</td>
                            <td className="py-3 px-3 text-zinc-500 font-mono text-[11px]">{order.date}</td>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-zinc-300">{cust?.name}</div>
                              <div className="text-[10px] text-zinc-500 font-mono">{cust?.phone}</div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-zinc-250">{order.total} Tk</td>
                            <td className="py-3 px-4 text-center">
                              <select
                                value={order.status}
                                onChange={e => handleUpdateOrderStatus(order.id, e.target.value as any)}
                                className={`bg-zinc-950 text-[10px] font-semibold rounded border px-2 py-0.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans ${
                                  order.status === "Delivered"
                                    ? "text-emerald-400 border-emerald-500/20"
                                    : order.status === "Returned"
                                    ? "text-rose-400 border-rose-500/20"
                                    : order.status === "Dispatched"
                                    ? "text-blue-400 border-blue-500/20"
                                    : order.status === "Confirmed"
                                    ? "text-cyan-400 border-cyan-500/20"
                                    : "text-amber-400 border-amber-500/20"
                                }`}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Dispatched">Dispatched</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Returned">Returned</option>
                              </select>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px]">
                              {order.courier !== "None" ? (
                                <div className="flex flex-col">
                                  <span className="text-zinc-300 font-semibold">{order.courier}</span>
                                  <span className="text-[9px] text-zinc-500">{order.tracking}</span>
                                </div>
                              ) : (
                                <span className="text-zinc-600 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyInvoiceText(order, cust!)}
                                  className={`p-1.5 rounded border transition-colors ${
                                    copiedInvoiceId === order.id
                                      ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/30"
                                      : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:text-zinc-200"
                                  }`}
                                  title="Copy plain-text receipt for Facebook DM"
                                >
                                  {copiedInvoiceId === order.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => setSelectedInvoiceOrder(order)}
                                  className="px-2.5 py-1 bg-zinc-950 text-zinc-400 border border-zinc-850 rounded hover:text-white flex items-center gap-1.5 text-[10px] font-semibold transition-colors"
                                  title="View or download formal BDT invoice"
                                >
                                  <FileText className="h-3 w-3 text-purple-400" />
                                  <span>Invoice</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleArchiveOrder(order.id, !order.isArchived)}
                                  className={`p-1.5 rounded border transition-colors ${
                                    order.isArchived
                                      ? "bg-purple-950/20 text-purple-400 border-purple-500/30 hover:bg-purple-950/40"
                                      : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:text-purple-400 hover:border-purple-500/20"
                                  }`}
                                  title={order.isArchived ? "Unarchive Order" : "Archive Order"}
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="p-1.5 bg-zinc-950 text-zinc-550 border border-zinc-850 hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-950/10 rounded transition-colors"
                                  title="Permanently Delete Order"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ==========================================
              3. CUSTOMERS CRM VIEW
              ========================================== */}
          {activeTab === "customers" && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold text-white">Customer Relationship (CRM) Database</h2>
                <p className="text-xs text-zinc-500">Track jewelry client lifetime values, scan return rate metrics, and manage Fraud Shield alerts.</p>
              </div>

              {/* SEARCH BOX */}
              <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl flex items-center shadow-sm">
                <div className="w-full md:w-80 relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-650" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Search by customer name, phone, or location..."
                    className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded px-8 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/80 transition-all"
                  />
                </div>
              </div>

              {/* CUSTOMERS DATA TABLE */}
              <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[10px] text-zinc-500 font-semibold bg-zinc-900/50 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Customer Name</th>
                      <th className="py-3.5 px-3">Phone Contact</th>
                      <th className="py-3.5 px-3">Primary Delivery Address</th>
                      <th className="py-3.5 px-3 text-right">LTV (Lifetime Value)</th>
                      <th className="py-3.5 px-4 text-center">Return Rate</th>
                      <th className="py-3.5 px-4 text-center">Trust Risk</th>
                      <th className="py-3.5 px-4 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-zinc-600 font-mono">No customers recorded.</td>
                      </tr>
                    ) : (
                      filteredCustomers.map(customer => {
                        const stats = customerStatsMap[customer.id] || { ltv: 0, returns: 0, count: 0, avgOrder: 0 };
                        // Dynamically override CRM mock rates for warning display
                        const returnRateVal = customer.returnRate || (stats.count > 0 ? Math.round((stats.returns / stats.count) * 100) : 0);
                        const isHighRisk = returnRateVal > 15;

                        return (
                          <tr key={customer.id} className="border-b border-zinc-900/50 hover:bg-zinc-900/20 transition-colors">
                            <td className="py-3 px-4 font-semibold text-zinc-200">{customer.name}</td>
                            <td className="py-3 px-3 font-mono text-[11px] text-zinc-400">{customer.phone}</td>
                            <td className="py-3 px-3 text-zinc-450 truncate max-w-[200px]" title={customer.address}>{customer.address}</td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-zinc-200">{stats.ltv} Tk</td>
                            <td className="py-3 px-4 text-center font-mono font-semibold">
                              <span className={isHighRisk ? "text-rose-450" : "text-emerald-400"}>
                                {returnRateVal}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {customer.blacklisted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 text-rose-450 text-[9px] font-bold uppercase animate-pulse">
                                  <AlertCircle className="h-3 w-3" /> Blacklisted
                                </span>
                              ) : isHighRisk ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-455 text-[9px] font-bold uppercase">
                                  <AlertCircle className="h-3 w-3" /> High Risk
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase">
                                  <UserCheck className="h-3 w-3" /> Trusted
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 animate-in fade-in duration-200">
                                <button
                                  type="button"
                                  onClick={() => setSelectedCustomerProfileId(customer.id)}
                                  className="bg-zinc-950 text-zinc-450 hover:text-white px-2 py-1 rounded border border-zinc-850 flex items-center gap-1 text-[10px] font-medium transition-colors"
                                  title="View CRM profile"
                                >
                                  <Eye className="h-3.5 w-3.5" /> View CRM
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleCustomerBlacklist(customer.id)}
                                  className={`px-2 py-1 rounded border text-[10px] font-bold uppercase transition-all ${
                                    customer.blacklisted
                                      ? "bg-rose-950/20 text-rose-455 border-rose-500/20 hover:bg-rose-900/10"
                                      : "bg-zinc-950 text-zinc-500 border-zinc-850 hover:text-rose-405 hover:border-rose-500/20"
                                  }`}
                                  title={customer.blacklisted ? "Whitelist customer" : "Blacklist customer"}
                                >
                                  {customer.blacklisted ? "Whitelist" : "Blacklist"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ==========================================
              4. STOCK MANAGER TAB VIEW (INVENTORY ERP)
              ========================================== */}
          {activeTab === "stock" && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              
              <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base font-semibold text-white">Stock ERP Inventory Manager</h2>
                  <p className="text-xs text-zinc-500">Edit product selling values, monitor cost price metrics, and review low-stock jewelry thresholds.</p>
                </div>
                <button
                  onClick={() => {
                    if (editingProduct) {
                      setEditingProduct(null);
                      setNewProdId("");
                      setNewProdName("");
                      setNewProdCategory("Rings");
                      setNewProdCost(0);
                      setNewProdPrice(0);
                      setNewProdStock(0);
                      setIsAddProductOpen(true);
                    } else {
                      setIsAddProductOpen(!isAddProductOpen);
                    }
                  }}
                  className="bg-zinc-805 hover:bg-zinc-700 text-zinc-200 border border-zinc-750 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Plus className="h-4 w-4" />{" "}
                  {editingProduct ? "Switch to Add" : isAddProductOpen ? "Hide Form" : "Add Product"}
                </button>
              </div>

              {(isAddProductOpen || editingProduct) && (
                <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-4 flex flex-col gap-3 shadow-md animate-in slide-in-from-top-2 duration-300">
                  <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    {editingProduct ? `Edit Product: ${editingProduct.id}` : "Add New Product to ERP"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 font-mono uppercase">SKU / ID Code</label>
                      <input
                        type="text"
                        disabled={!!editingProduct}
                        value={newProdId}
                        onChange={e => setNewProdId(e.target.value)}
                        placeholder="SKU-RING-07"
                        className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-[10px] text-zinc-500 font-mono uppercase">Product Description</label>
                      <input
                        type="text"
                        value={newProdName}
                        onChange={e => setNewProdName(e.target.value)}
                        placeholder="Zirconia Flower Ring"
                        className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 font-mono uppercase">Category</label>
                      <select
                        value={newProdCategory}
                        onChange={e => setNewProdCategory(e.target.value)}
                        className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2 py-1.5 text-zinc-205 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="Rings">Rings</option>
                        <option value="Topi">Topi</option>
                        <option value="Perfumes">Perfumes</option>
                        <option value="Shemagh">Shemagh</option>
                        <option value="Watches">Watches</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 font-mono uppercase">Cost (Tk)</label>
                      <input
                        type="number"
                        value={newProdCost}
                        onChange={e => setNewProdCost(parseInt(e.target.value) || 0)}
                        className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 font-mono uppercase">Price (Tk)</label>
                      <input
                        type="number"
                        value={newProdPrice}
                        onChange={e => setNewProdPrice(parseInt(e.target.value) || 0)}
                        className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500 font-mono uppercase">{editingProduct ? "Current Stock" : "Initial Stock"}</label>
                      <input
                        type="number"
                        value={newProdStock}
                        onChange={e => setNewProdStock(parseInt(e.target.value) || 0)}
                        className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      />
                    </div>
                    <div className="flex gap-2 md:col-span-2 mt-2">
                      <button
                        type="submit"
                        className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold px-4 py-1.5 rounded text-xs transition-colors shadow-sm active:scale-[0.98]"
                      >
                        {editingProduct ? "Update Product" : "Save Product"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddProductOpen(false);
                          setEditingProduct(null);
                          setNewProdId("");
                          setNewProdName("");
                          setNewProdCategory("Rings");
                          setNewProdCost(0);
                          setNewProdPrice(0);
                          setNewProdStock(0);
                        }}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 px-4 py-1.5 rounded text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* SEARCH & FILTERS ROW */}
              <div className="bg-zinc-900/30 border border-zinc-900 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
                
                {/* Search */}
                <div className="w-full md:w-80 relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-650" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={e => setStockSearch(e.target.value)}
                    placeholder="Search by SKU details, product name..."
                    className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded px-8 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/80 transition-all"
                  />
                </div>

                {/* Category filters */}
                <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-900 overflow-x-auto">
                  {["All", "Rings", "Topi", "Perfumes", "Shemagh", "Watches"].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setStockCategoryFilter(cat)}
                      className={`px-3 py-1 text-[10px] font-semibold rounded uppercase tracking-wider transition-colors ${
                        stockCategoryFilter === cat
                          ? "bg-zinc-850 text-white border border-zinc-700 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* INVENTORY ERP DATA GRID */}
              <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[10px] text-zinc-500 font-semibold bg-zinc-900/50 uppercase tracking-wider">
                      <th className="py-3.5 px-4">SKU / ID Code</th>
                      <th className="py-3.5 px-3">Product Description</th>
                      <th className="py-3.5 px-3">Category</th>
                      <th className="py-3.5 px-3 text-center w-32">Cost Price (Tk)</th>
                      <th className="py-3.5 px-3 text-center w-32">Selling Price (Tk)</th>
                      <th className="py-3.5 px-4 text-center w-28">Stock Level</th>
                      <th className="py-3.5 px-3 text-center">Status</th>
                      <th className="py-3.5 px-4 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {filteredStock.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-zinc-600 font-mono">No stock units matching criteria.</td>
                      </tr>
                    ) : (
                      filteredStock.map(product => {
                        const isLowStock = product.stock < 5;
                        const isOutOfStock = product.stock === 0;

                        return (
                          <tr key={product.id} className="border-b border-zinc-900/50 hover:bg-zinc-900/20 transition-colors">
                            <td className="py-3 px-4 font-mono text-[11px] font-semibold text-zinc-400">{product.id}</td>
                            <td className="py-3 px-3 font-semibold text-zinc-200">{product.name}</td>
                            <td className="py-3 px-3 text-zinc-500 font-mono text-[11px]">{product.category}</td>
                            
                            {/* Cost Input */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1 font-mono">
                                <input
                                  type="number"
                                  value={product.cost}
                                  onChange={e => handleStockUpdate(product.id, "cost", parseInt(e.target.value) || 0)}
                                  className="w-16 bg-zinc-950 text-xs border border-zinc-850 rounded px-1.5 py-1 text-center font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-100"
                                />
                                <span className="text-[10px] text-zinc-600">Tk</span>
                              </div>
                            </td>

                            {/* Price Input */}
                            <td className="py-3 px-3 text-center">
                              <div className="flex items-center justify-center gap-1 font-mono">
                                <input
                                  type="number"
                                  value={product.price}
                                  onChange={e => handleStockUpdate(product.id, "price", parseInt(e.target.value) || 0)}
                                  className="w-16 bg-zinc-950 text-xs border border-zinc-850 rounded px-1.5 py-1 text-center font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-100"
                                />
                                <span className="text-[10px] text-zinc-600">Tk</span>
                              </div>
                            </td>

                            {/* Stock level inline edit */}
                            <td className="py-3 px-4 text-center">
                              <input
                                type="number"
                                value={product.stock}
                                onChange={e => handleStockUpdate(product.id, "stock", parseInt(e.target.value) || 0)}
                                className={`w-14 text-center font-mono text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold ${
                                  isOutOfStock
                                    ? "bg-rose-950/20 text-rose-450 border-rose-900/40"
                                    : isLowStock
                                    ? "bg-amber-950/20 text-amber-400 border-amber-900/40"
                                    : "bg-zinc-950 text-zinc-200 border-zinc-850"
                                }`}
                              />
                            </td>

                            {/* Status label */}
                            <td className="py-3 px-3 text-center">
                              {isOutOfStock ? (
                                <span className="inline-block px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] font-bold uppercase">
                                  Out of Stock
                                </span>
                              ) : isLowStock ? (
                                <span className="inline-block px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold uppercase animate-pulse">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase">
                                  Adequate
                                </span>
                              )}
                            </td>
                            {/* Actions Column */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setNewProdId(product.id);
                                    setNewProdName(product.name);
                                    setNewProdCategory(product.category);
                                    setNewProdCost(product.cost);
                                    setNewProdPrice(product.price);
                                    setNewProdStock(product.stock);
                                    setIsAddProductOpen(false);
                                  }}
                                  className="p-1 hover:text-emerald-400 text-zinc-650 transition-colors"
                                  title="Edit Product Details"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="p-1 hover:text-rose-400 text-zinc-650 transition-colors"
                                  title="Delete Product"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ==========================================
              5. RECOVERY HUB TAB VIEW
              ========================================== */}
          {activeTab === "recovery" && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-200">
              
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-semibold text-white">Cart Abandonment & Recovery Hub</h2>
                <p className="text-xs text-zinc-500">Recover lost DM carts using pre-encoded templates linked directly to WhatsApp API (zero-cost direct CRM marketing).</p>
              </div>

              {/* LIST TABLE */}
              <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-900 text-[10px] text-zinc-500 font-semibold bg-zinc-900/50 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Lead Name</th>
                      <th className="py-3.5 px-3">Phone</th>
                      <th className="py-3.5 px-3">Abandoned Items</th>
                      <th className="py-3.5 px-3 text-right">Value (Tk)</th>
                      <th className="py-3.5 px-3">Lead Date</th>
                      <th className="py-3.5 px-4 text-center">Action Link</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {activeLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-zinc-600 font-mono">No abandoned carts flagged.</td>
                      </tr>
                    ) : (
                      activeLeads.map(lead => (
                        <tr key={lead.id} className="border-b border-zinc-900/50 hover:bg-zinc-900/20 transition-colors">
                          <td className="py-3 px-4 font-semibold text-zinc-200">{lead.name}</td>
                          <td className="py-3 px-3 font-mono text-[11px] text-zinc-405">{lead.phone}</td>
                          <td className="py-3 px-3 text-zinc-450">{lead.items}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-zinc-250">{lead.value} {activeWorkspace?.currency || "Tk"}</td>
                          <td className="py-3 px-3 text-zinc-500 font-mono text-[11px]">{lead.date}</td>
                          <td className="py-3 px-4 text-center">
                            <a
                              href={getWhatsAppRecoveryLink(lead)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold px-3 py-1 rounded text-[10px] inline-flex items-center gap-1 transition-colors active:scale-[0.98]"
                            >
                              <Smartphone className="h-3 w-3" /> Recover (WhatsApp)
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ==========================================
              6. SETTINGS TAB VIEW
              ========================================== */}
          {activeTab === "settings" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-2xl">
              
              <div className="flex flex-col gap-0.5 border-b border-zinc-900 pb-3">
                <h2 className="text-base font-semibold text-white">System Settings</h2>
                <p className="text-xs text-zinc-500">Configure Supabase credentials, shipping fees, and store metadata.</p>
              </div>

              {/* Shop Info */}
              <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-5 flex flex-col gap-4">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="h-4.5 w-4.5 text-zinc-500" /> Store Profile & Pricing
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-400">Shop Name</label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-400">Inside Dhaka Delivery (Tk)</label>
                    <input
                      type="number"
                      value={shippingInside}
                      onChange={e => setShippingInside(parseInt(e.target.value) || 0)}
                      className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-400">Outside Dhaka Delivery (Tk)</label>
                    <input
                      type="number"
                      value={shippingOutside}
                      onChange={e => setShippingOutside(parseInt(e.target.value) || 0)}
                      className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dangerous Area / System Reset */}
              <div className="bg-red-950/10 border border-red-900/20 rounded-xl p-5 flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Trash2 className="h-4.5 w-4.5 text-rose-450" /> Dangerous Area
                  </h3>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Reset all databases and log out the current session. This will permanently clear all local workspaces, customer data, and checkout orders stored inside this browser.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleSystemReset}
                    className="bg-rose-950/30 hover:bg-rose-900/40 text-rose-400 border border-rose-900/30 font-bold px-4 py-2 rounded text-xs transition-all active:scale-[0.98] font-mono tracking-wide uppercase"
                  >
                    Clear All Workspace Data
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ==========================================
              7. ACCOUNT MANAGEMENT VIEW (ADMIN ONLY)
              ========================================== */}
          {activeTab === "accounts" && (
            sessionUser?.role === "Admin" ? (
              <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-bold text-white font-mono uppercase tracking-wider">Account & Authorization Directory</h2>
                    <p className="text-[11px] text-zinc-500">Manage user access credentials, assign business workspaces, and revoke active operational session tokens (IAM/RBAC Control Panel).</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono border border-purple-900/30 px-2.5 py-1 rounded bg-purple-950/10 text-purple-400">
                    <Lock className="h-3 w-3" />
                    <span>ROOT ACCESS ACTIVE</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* LEFT: USER ACCOUNTS DIRECTORY */}
                  <div className="lg:col-span-2 flex flex-col gap-4">
                    <div className="bg-zinc-900/30 border border-zinc-900 rounded-xl overflow-hidden shadow-sm">
                      <div className="px-4 py-3 border-b border-zinc-900 bg-zinc-900/50 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider font-mono">Registered Accounts</span>
                        <span className="text-[9px] text-zinc-500 font-mono">Total Users: {users.length}</span>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-900 text-[10px] text-zinc-500 font-semibold bg-zinc-950/40 uppercase tracking-wider font-mono">
                              <th className="py-3 px-4">Username</th>
                              <th className="py-3 px-3">Role Status</th>
                              <th className="py-3 px-3">Password</th>
                              <th className="py-3 px-3">Allowed Workspaces</th>
                              <th className="py-3 px-3 text-center">Token Hash</th>
                              <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900 text-xs">
                            {users.map(u => {
                              const isRoot = u.username === "masteryousha";
                              return (
                                <tr key={u.username} className="hover:bg-zinc-900/20 transition-colors">
                                  <td className="py-3.5 px-4 font-semibold text-white font-mono flex items-center gap-1.5">
                                    {u.username}
                                    {isRoot && (
                                      <span className="text-[7px] font-bold uppercase bg-purple-950 text-purple-400 border border-purple-800/40 px-1 py-0.5 rounded">Root</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-3">
                                    {isRoot ? (
                                      <span className="text-[9px] text-zinc-500 font-bold font-mono">Admin</span>
                                    ) : (
                                      <select
                                        value={u.role}
                                        onChange={e => handleUpdateUserRole(u.username, e.target.value as any)}
                                        className="bg-zinc-950 text-[10px] border border-zinc-850 rounded px-2 py-1 text-zinc-350 focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
                                      >
                                        <option value="Admin">Admin</option>
                                        <option value="Non-Admin">Non-Admin</option>
                                      </select>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-3 font-mono text-zinc-400">
                                    <div className="flex items-center gap-2">
                                      <span>
                                        {showPasswords[u.username] !== false ? (u.password || "••••••••") : "••••••••"}
                                      </span>
                                      {u.password && (
                                        <button
                                          type="button"
                                          onClick={() => setShowPasswords(prev => ({ ...prev, [u.username]: prev[u.username] === false }))}
                                          className="p-1 hover:text-white text-zinc-650 transition-colors"
                                          title={showPasswords[u.username] !== false ? "Hide Password" : "Show Password"}
                                        >
                                          {showPasswords[u.username] !== false ? (
                                            <EyeOff className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                                          ) : (
                                            <Eye className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-3 max-w-[180px] truncate">
                                    {u.role === "Admin" ? (
                                      <span className="text-[10px] text-zinc-500 font-semibold font-mono">All (Global)</span>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        <div className="text-[10px] text-zinc-300 font-mono truncate">
                                          {u.assignedWorkspaces.length === 0
                                            ? "None"
                                            : u.assignedWorkspaces.map(id => workspaces.find(w => w.id === id)?.name || id).join(", ")
                                          }
                                        </div>
                                        <div className="flex gap-1.5 flex-wrap mt-1">
                                          {workspaces.map(w => {
                                            const isChecked = u.assignedWorkspaces.includes(w.id);
                                            return (
                                              <button
                                                key={w.id}
                                                type="button"
                                                onClick={() => {
                                                  const nextWs = isChecked
                                                    ? u.assignedWorkspaces.filter(id => id !== w.id)
                                                    : [...u.assignedWorkspaces, w.id];
                                                  handleUpdateUserWorkspaces(u.username, nextWs);
                                                }}
                                                className={`text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                                                  isChecked
                                                    ? "bg-purple-950/20 text-purple-400 border-purple-500/20"
                                                    : "bg-zinc-950 text-zinc-650 border-zinc-900 hover:text-zinc-400"
                                                }`}
                                              >
                                                {w.name}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-3 text-center font-mono text-[10px] text-zinc-500">
                                    v{u.passwordVersion}
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setResettingUser(u)}
                                        className="text-[9px] font-mono px-2 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-350 rounded transition-colors"
                                      >
                                        Reset Pass
                                      </button>
                                      {!isRoot && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteUser(u.username)}
                                          className="p-1 hover:text-rose-400 text-zinc-600 transition-colors"
                                          title="Delete Account"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: CREATE USER ACCOUNT CONSOLE */}
                  <div className="flex flex-col gap-4">
                    <form onSubmit={handleCreateUser} className="bg-zinc-900/30 border border-zinc-900 rounded-xl p-5 flex flex-col gap-4 shadow-sm">
                      <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider font-mono">Create User Console</span>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-zinc-550 font-mono uppercase">Username</label>
                        <input
                          type="text"
                          required
                          value={newUsername}
                          onChange={e => setNewUsername(e.target.value)}
                          placeholder="johndoe"
                          className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-zinc-550 font-mono uppercase">Initial Password</label>
                        <input
                          type="text"
                          required
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Password123"
                          className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-zinc-550 font-mono uppercase">User Role Permissions</label>
                        <div className="grid grid-cols-2 gap-2 mt-0.5">
                          <button
                            type="button"
                            onClick={() => setNewUserRole("Admin")}
                            className={`py-1.5 text-xs font-mono font-bold rounded border transition-all ${
                              newUserRole === "Admin"
                                ? "bg-purple-950/30 text-purple-400 border-purple-500/40"
                                : "bg-zinc-950 text-zinc-550 border-zinc-900 hover:text-zinc-400"
                            }`}
                          >
                            Admin
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewUserRole("Non-Admin")}
                            className={`py-1.5 text-xs font-mono font-bold rounded border transition-all ${
                              newUserRole === "Non-Admin"
                                ? "bg-purple-950/30 text-purple-400 border-purple-500/40"
                                : "bg-zinc-950 text-zinc-550 border-zinc-900 hover:text-zinc-400"
                            }`}
                          >
                            Non-Admin
                          </button>
                        </div>
                      </div>

                      {newUserRole === "Non-Admin" && (
                        <div className="flex flex-col gap-1.5 border-t border-zinc-900 pt-3 mt-1 animate-in slide-in-from-top-1 duration-150">
                          <label className="text-[10px] text-zinc-550 font-mono uppercase">Assign Business Workspaces</label>
                          {workspaces.length === 0 ? (
                            <span className="text-[9px] text-zinc-650 font-mono">No workspaces created yet to assign.</span>
                          ) : (
                            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-1 bg-zinc-950/40 p-2 rounded border border-zinc-850">
                              {workspaces.map(ws => {
                                const isChecked = newUserWorkspaces.includes(ws.id);
                                return (
                                  <label key={ws.id} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 cursor-pointer select-none text-[11px]">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setNewUserWorkspaces(prev =>
                                          isChecked
                                            ? prev.filter(id => id !== ws.id)
                                            : [...prev, ws.id]
                                        );
                                      }}
                                      className="rounded bg-zinc-950 border-zinc-800 text-purple-600 focus:ring-0 focus:ring-offset-0 h-3.5 w-3.5"
                                    />
                                    <span className="font-mono">{ws.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="bg-purple-650 hover:bg-purple-550 text-white font-bold font-mono py-2 rounded text-xs transition-all active:scale-[0.98] uppercase mt-2 shadow-md tracking-wider"
                      >
                        Deploy New User Account
                      </button>
                    </form>
                  </div>
                </div>

                {/* MODAL: RESET PASSWORD */}
                {resettingUser && (
                  <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <form onSubmit={handleResetPasswordSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                        <h3 className="text-xs font-bold text-white font-mono uppercase">Reset Password Console</h3>
                        <button
                          type="button"
                          onClick={() => {
                            setResettingUser(null);
                            setNewResetPassword("");
                          }}
                          className="text-zinc-550 hover:text-zinc-300 text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="p-5 flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-zinc-500 font-mono uppercase">Username</span>
                          <span className="text-xs font-bold text-white font-mono bg-zinc-950 px-2.5 py-1.5 rounded border border-zinc-850 select-none">
                            {resettingUser.username}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-500 font-mono uppercase">New Secure Password</label>
                          <input
                            type="text"
                            required
                            value={newResetPassword}
                            onChange={e => setNewResetPassword(e.target.value)}
                            placeholder="nEnterNewSecurePassword!"
                            className="bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-150 focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                          />
                        </div>

                        <div className="bg-amber-950/10 border border-amber-900/20 text-amber-500 rounded p-3 text-[10px] leading-relaxed flex items-start gap-2 font-mono">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                          <span>
                            WARNING: Changing this password increments the ledger Version Hash. If this user is currently operating Terminus, their active session token will be immediately revoked, and they will be logged out of their view context.
                          </span>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-950 border-t border-zinc-850 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setResettingUser(null);
                            setNewResetPassword("");
                          }}
                          className="text-xs text-zinc-500 hover:text-zinc-300 font-semibold px-3 py-1.5"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="bg-purple-650 hover:bg-purple-550 text-white font-bold font-mono px-4 py-1.5 rounded text-xs transition-all active:scale-[0.98]"
                        >
                          Update & Revoke Sessions
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              /* ELEGANT 403 UNAUTHORIZED ACCESS ERROR BLOCK */
              <div className="flex flex-col items-center justify-center min-h-[480px] bg-zinc-950 border border-zinc-900 rounded-xl p-8 text-center animate-in fade-in duration-200">
                <div className="h-14 w-14 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-4 animate-bounce">
                  <Lock className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider">403 Forbidden Access</h2>
                <p className="text-xs text-rose-455 font-mono uppercase tracking-widest mt-1">Access Denied // Authorization Shield Active</p>
                <p className="text-[11px] text-zinc-500 max-w-sm mt-3 leading-relaxed">
                  Your active session credentials are not authorized to view the Account Management control panel. This directory is strictly restricted to administrative level roles.
                </p>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className="mt-6 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-mono text-xs px-4 py-2 rounded-lg transition-all"
                >
                  Return to Dashboard
                </button>
              </div>
            )
          )}

        </div>
      </div>

      {/* ==========================================
          MODAL: CREATE NEW ORDER SLIP
          ========================================== */}
      {isCreateOrderOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4.5 w-4.5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Create New Order Slip</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOrderOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              
              {/* SMART PASTE DM PARSER */}
              <div className="flex flex-col gap-1 bg-zinc-950/40 border border-zinc-850 p-3 rounded-lg">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between font-mono">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-purple-400" />
                    Smart Paste Facebook DM Parser
                  </span>
                  {smartPasteText && (
                    <button
                      type="button"
                      onClick={() => {
                        setSmartPasteText("");
                        setSlipPhone("");
                        setSlipName("");
                        setSlipAddress("");
                      }}
                      className="text-[9px] text-zinc-500 hover:text-zinc-350 transition-colors uppercase font-semibold"
                    >
                      ✕ Clear
                    </button>
                  )}
                </label>
                <textarea
                  value={smartPasteText}
                  onChange={e => handleSmartPasteChange(e.target.value)}
                  placeholder="Paste unformatted message block from FB Messenger (e.g. 'Maliha Rahman, 01712345678, Dhanmondi, Dhaka')"
                  rows={2}
                  className="w-full bg-zinc-950/80 text-xs border border-zinc-850 rounded px-2.5 py-1.5 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none font-mono leading-relaxed"
                />
                {smartPasteText && (
                  <div className="text-[9px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                    <Check className="h-3 w-3 shrink-0" />
                    <span>Autofill completed. Verify fields below.</span>
                  </div>
                )}
              </div>

              {/* Phone Input with CRM match feedback */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Smartphone className="h-3 w-3" /> Phone Number (Bangladeshi Format)
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={slipPhone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 placeholder:text-zinc-700 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                
                {/* Fraud Shield Banner (Alert if blacklisted OR return rate > 15%) */}
                {currentPhoneCustomerMatch && (
                  <div className={`p-2.5 rounded border mt-1 flex gap-2 items-start ${
                    currentPhoneCustomerMatch.blacklisted || currentPhoneCustomerMatch.returnRate > 15
                      ? "bg-rose-950/20 border-rose-500/20 text-rose-400 font-semibold"
                      : "bg-emerald-950/20 border-emerald-500/20 text-emerald-400"
                  }`}>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="text-[10px] flex-1">
                      {currentPhoneCustomerMatch.blacklisted ? (
                        <p>
                          <strong>🚫 CRITICAL WARNING: BLACKLISTED CUSTOMER!</strong> This specific customer has been manually blacklisted. Proceed with extreme caution.
                        </p>
                      ) : currentPhoneCustomerMatch.returnRate > 15 ? (
                        <p>
                          <strong>⚠️ FRAUD SHIELD HIGH-ALERT:</strong> Phone history shows multiple returned packages ({currentPhoneCustomerMatch.returnRate}% return rate). Request bKash advance for delivery fee.
                        </p>
                      ) : (
                        <p>
                          <strong>✓ Trusted CRM Profile:</strong> This customer has a return rate of <strong>{currentPhoneCustomerMatch.returnRate}%</strong>. Verified safe.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Name & Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Customer Name</label>
                  <input
                    type="text"
                    value={slipName}
                    onChange={e => setSlipName(e.target.value)}
                    placeholder="Enter customer name"
                    className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Delivery Zone</label>
                  <div className="grid grid-cols-2 gap-2 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setSlipDistrict("inside")}
                      className={`py-1 rounded text-[10px] font-semibold border transition-all ${
                        slipDistrict === "inside"
                          ? "bg-zinc-800 text-emerald-400 border-emerald-500/30"
                          : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                      }`}
                    >
                      Inside Dhaka
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlipDistrict("outside")}
                      className={`py-1 rounded text-[10px] font-semibold border transition-all ${
                        slipDistrict === "outside"
                          ? "bg-zinc-800 text-emerald-400 border-emerald-500/30"
                          : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300"
                      }`}
                    >
                      Outside Dhaka
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Detailed Delivery Address
                </label>
                <textarea
                  rows={2}
                  value={slipAddress}
                  onChange={e => setSlipAddress(e.target.value)}
                  placeholder="House number, road number, area, district..."
                  className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded px-2.5 py-1.5 text-zinc-100 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Linked Product Selector */}
              <div className="border-t border-zinc-800 pt-3.5 flex flex-col gap-2">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Select Jewelry Items
                </label>
                <div className="flex gap-2">
                  <select
                    value={slipSelectedProductId}
                    onChange={e => setSlipSelectedProductId(e.target.value)}
                    className="flex-1 bg-zinc-950 text-xs border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {activeInventory.map(p => (
                      <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                        {p.name} - {p.price} {activeWorkspace?.currency || "Tk"} ({p.stock <= 0 ? "Out of Stock" : `${p.stock} in stock`})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddSlipItem}
                    className="bg-zinc-850 hover:bg-zinc-800 text-zinc-200 border border-zinc-750 px-3 rounded text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* Added items list */}
              {slipItems.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {slipItems.map(item => {
                    const prod = inventory.find(p => p.id === item.productId);
                    if (!prod) return null;

                    return (
                      <div key={item.productId} className="flex items-center justify-between bg-zinc-950/60 border border-zinc-850 rounded p-2 text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-zinc-300">{prod.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">{prod.price} Tk each</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded">
                            <button
                              type="button"
                              onClick={() => handleUpdateSlipItemQuantity(item.productId, -1)}
                              className="p-1 text-zinc-400 hover:text-zinc-200"
                            >
                              <MinusCircle className="h-4 w-4" />
                            </button>
                            <span className="w-6 text-center font-mono font-medium text-zinc-300">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateSlipItemQuantity(item.productId, 1)}
                              className="p-1 text-zinc-400 hover:text-zinc-200"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSlipItems(prev => prev.filter(i => i.productId !== item.productId))}
                            className="p-1 text-zinc-500 hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal calculations & Confirmation Actions */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3 text-xs items-center">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 font-sans">Delivery Cost:</span>
                  <span className="font-mono text-zinc-350">{slipDistrict === "inside" ? shippingInside : shippingOutside} Tk</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-zinc-500 shrink-0 font-sans">Discount (Tk):</span>
                  <input
                    type="number"
                    value={slipDiscount}
                    onChange={e => setSlipDiscount(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-20 bg-zinc-950 text-xs border border-zinc-850 rounded px-1.5 py-0.5 text-center font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 text-zinc-150"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-zinc-850/60 pt-2">
                <span className="text-xs font-semibold text-zinc-400 font-sans">Total COD amount payable:</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {slipItems.reduce((sum, item) => {
                    const prod = inventory.find(p => p.id === item.productId);
                    return sum + (prod ? prod.price * item.quantity : 0);
                  }, 0) + (slipDistrict === "inside" ? shippingInside : shippingOutside) - slipDiscount} Tk
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => handleConfirmOrderSlip(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 py-2 rounded text-xs font-semibold active:scale-[0.98] transition-all"
                >
                  Confirm & Save
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmOrderSlip(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-zinc-950 py-2 rounded text-xs font-bold active:scale-[0.98] transition-all shadow-sm"
                >
                  Confirm & PDF
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: CUSTOMER PROFILE (CRM VIEW DETAILS)
          ========================================== */}
      {selectedCustomerProfileId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          {(() => {
            const customer = customers.find(c => c.id === selectedCustomerProfileId);
            if (!customer) return null;

            const stats = customerStatsMap[customer.id] || { ltv: 0, returns: 0, count: 0, avgOrder: 0 };
            const custOrders = orders.filter(o => o.customerId === customer.id);
            const isHighRisk = customer.returnRate > 15 || (stats.count > 0 && (stats.returns / stats.count) * 100 > 15);

            return (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                  <div className="flex items-center gap-2">
                    <Users className="h-4.5 w-4.5 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Customer CRM Profile</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerProfileId(null)}
                    className="text-zinc-500 hover:text-zinc-300 text-xs"
                  >
                    ✕ Close
                  </button>
                </div>

                {/* Profile Details */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  
                  {/* Summary row */}
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-base font-bold text-white">{customer.name}</h4>
                      <span className="text-[11px] font-mono text-zinc-500">{customer.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCustomerBlacklist(customer.id)}
                        className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase transition-colors ${
                          customer.blacklisted
                            ? "bg-rose-950/20 text-rose-400 border-rose-500/20 hover:bg-rose-900/10"
                            : "bg-zinc-950 text-zinc-500 border-zinc-850 hover:text-rose-400"
                        }`}
                      >
                        {customer.blacklisted ? "Whitelist" : "Blacklist"}
                      </button>

                      {customer.blacklisted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold uppercase animate-pulse">
                          <AlertTriangle className="h-3.5 w-3.5" /> Blacklisted
                        </span>
                      ) : isHighRisk ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-455 text-[10px] font-bold uppercase">
                          <AlertTriangle className="h-3.5 w-3.5" /> Return Risk High
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
                          <UserCheck className="h-3.5 w-3.5" /> Trusted Customer
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-3.5 rounded border border-zinc-850 text-xs flex flex-col gap-1.5">
                    <span className="text-zinc-500 uppercase text-[9px] font-semibold tracking-wider">Default Shipping Address</span>
                    <span className="text-zinc-250 leading-relaxed">{customer.address}</span>
                  </div>

                  {/* LTV & Return stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-950 p-3 rounded border border-zinc-850 flex flex-col gap-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">CRM LTV</span>
                      <span className="text-sm font-bold text-zinc-250 font-mono">{stats.ltv} Tk</span>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded border border-zinc-850 flex flex-col gap-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Return Rate</span>
                      <span className={`text-sm font-bold font-mono ${isHighRisk ? "text-rose-450" : "text-emerald-400"}`}>
                        {customer.returnRate || (stats.count > 0 ? Math.round((stats.returns / stats.count) * 100) : 0)}%
                      </span>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded border border-zinc-850 flex flex-col gap-0.5">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Avg Order Value</span>
                      <span className="text-sm font-bold text-zinc-250 font-mono">{stats.avgOrder} Tk</span>
                    </div>
                  </div>

                  {/* Order History */}
                  <div className="flex flex-col gap-2 border-t border-zinc-850 pt-3">
                    <h5 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Order History</h5>
                    <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                      {custOrders.length === 0 ? (
                        <div className="text-xs text-zinc-650 italic py-2">No orders processed for this profile yet.</div>
                      ) : (
                        custOrders.map(o => (
                          <div key={o.id} className="flex items-center justify-between bg-zinc-950/40 border border-zinc-850/50 p-2 rounded text-xs">
                            <div className="flex flex-col gap-0.5 font-mono">
                              <span className="font-semibold text-zinc-300">{o.id}</span>
                              <span className="text-[10px] text-zinc-600">{o.date}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold font-mono text-zinc-250">{o.total} Tk</span>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                o.status === "Delivered"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : o.status === "Returned"
                                  ? "bg-rose-500/10 text-rose-400"
                                  : "bg-zinc-800 text-zinc-400"
                              }`}>
                                {o.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

              </div>
            );
          })()}
        </div>
      )}

      {/* ==========================================
          MODAL: INVOICE PREVIEW & ACTIONS
          ========================================== */}
      {selectedInvoiceOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-purple-400" />
                <h3 className="text-sm font-semibold text-white font-mono">Invoice Viewer & Print Console</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoiceOrder(null)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body (Styled Invoice Page) */}
            <div className="flex-1 overflow-y-auto p-6 bg-zinc-950/60 flex flex-col gap-6">
              {(() => {
                const order = selectedInvoiceOrder!;
                const cust = customers.find(c => c.id === order.customerId);
                const subtotal = order.items.reduce((sum, item) => {
                  const prod = inventory.find(p => p.id === item.productId);
                  return sum + (prod ? prod.price * item.quantity : 0);
                }, 0);

                return (
                  <div className="border border-zinc-850 bg-zinc-900/80 rounded-lg p-6 flex flex-col gap-6 relative shadow-md">
                    {/* Watermark/Logo Header */}
                    <div className="flex justify-between items-start border-b border-zinc-850 pb-4">
                      {(() => {
                        const ws = workspaces.find(w => w.id === order.workspaceId);
                        const wsName = ws?.name || "Terminus";
                        const wsNiche = ws?.niche || "Jewelry";
                        return (
                          <div>
                            <h4 className="text-sm font-bold text-white tracking-wide uppercase">{wsName}</h4>
                            <p className="text-[10px] text-zinc-500 font-mono">Premium {wsNiche} Retailer, Bangladesh</p>
                          </div>
                        );
                      })()}
                      <div className="text-right">
                        <div className={`text-[9px] font-bold px-2 py-0.5 rounded inline-block mb-1 border ${
                          order.status === "Delivered"
                            ? "text-emerald-400 bg-emerald-950/30 border-emerald-900/40"
                            : order.status === "Returned"
                            ? "text-rose-400 bg-rose-950/30 border-rose-900/40"
                            : "text-amber-400 bg-amber-950/30 border-amber-900/40"
                        }`}>
                          {order.status.toUpperCase()}
                        </div>
                        <p className="text-[11px] font-mono text-zinc-405">Order ID: #{order.id}</p>
                        <p className="text-[10px] text-zinc-500 font-mono">Date: {order.date}</p>
                      </div>
                    </div>

                    {/* Customer & Billing Info */}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="flex flex-col gap-1.5 bg-zinc-950/50 p-3 rounded border border-zinc-850/50">
                        <span className="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider">Customer Details</span>
                        <div className="font-semibold text-zinc-200">{cust?.name || "N/A"}</div>
                        <div className="text-zinc-400 font-mono">{cust?.phone || "N/A"}</div>
                        {cust?.blacklisted && (
                          <div className="text-[9px] font-bold text-rose-400 bg-rose-950/30 border border-rose-900/50 px-1.5 py-0.5 rounded w-max mt-0.5">
                            🚫 Blacklisted Profile
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 bg-zinc-950/50 p-3 rounded border border-zinc-850/50">
                        <span className="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider">Courier / Shipping</span>
                        <div className="text-zinc-300">
                          <span className="text-zinc-500 font-semibold">Location:</span> {order.shipping === shippingInside ? "Inside Dhaka" : "Outside Dhaka"}
                        </div>
                        <div className="text-zinc-300">
                          <span className="text-zinc-500 font-semibold">Courier:</span> {order.courier !== "None" ? order.courier : "Not Assigned"}
                        </div>
                        {order.tracking && (
                          <div className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 w-max mt-0.5">
                            Tracking: {order.tracking}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Shipping Address (Full Width) */}
                    <div className="bg-zinc-950/50 p-3 rounded border border-zinc-850/50 text-xs flex flex-col gap-1">
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider">Delivery Address</span>
                      <div className="text-zinc-350 font-mono leading-relaxed">{cust?.address || "No address provided."}</div>
                    </div>

                    {/* Items Table */}
                    <div className="border border-zinc-850/80 rounded-md overflow-hidden bg-zinc-950/20">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-zinc-950/80 border-b border-zinc-850 text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
                            <th className="py-2.5 px-3">Item Details</th>
                            <th className="py-2.5 px-3 text-right">Unit Price</th>
                            <th className="py-2.5 px-3 text-center">Qty</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, idx) => {
                            const prod = inventory.find(p => p.id === item.productId);
                            const lineTotal = (prod ? prod.price : 0) * item.quantity;
                            return (
                              <tr key={idx} className="border-b border-zinc-900/40 last:border-0 hover:bg-zinc-900/30 transition-colors">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-zinc-300">{prod?.name || "Unknown Product"}</div>
                                  <div className="text-[9px] text-zinc-500 font-mono">{item.productId}</div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-zinc-400">{(prod?.price || 0)} Tk</td>
                                <td className="py-2.5 px-3 text-center font-mono text-zinc-350">{item.quantity}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-zinc-200">{lineTotal} Tk</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Calculations summary */}
                    <div className="w-full flex justify-end">
                      <div className="w-full max-w-[280px] flex flex-col gap-2 text-xs font-mono">
                        <div className="flex justify-between items-center text-zinc-550">
                          <span>Subtotal:</span>
                          <span className="text-zinc-350">{subtotal} Tk</span>
                        </div>
                        <div className="flex justify-between items-center text-zinc-550">
                          <span>Shipping:</span>
                          <span className="text-zinc-350">+{order.shipping} Tk</span>
                        </div>
                        {order.discount > 0 && (
                          <div className="flex justify-between items-center text-rose-400">
                            <span>Discount:</span>
                            <span>-{order.discount} Tk</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center border-t border-zinc-850 pt-2 font-sans font-bold text-sm text-white">
                          <span>COD Total:</span>
                          <span className="text-emerald-400 font-mono">{order.total} Tk</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer note */}
                    {(() => {
                      const ws = workspaces.find(w => w.id === order.workspaceId);
                      const wsNiche = ws?.niche || "Jewelry";
                      return (
                        <div className="border-t border-zinc-850 pt-3 text-center flex flex-col gap-1 items-center justify-center">
                          <p className="text-[10px] text-zinc-500 font-mono">Please verify details upon delivery. Bangladesh {wsNiche.toLowerCase()} slip invoice.</p>
                          <p className="text-[9px] text-zinc-650 font-semibold font-mono tracking-wider">POWERED BY TERMINUS™</p>
                        </div>
                      );
                    })()}

                  </div>
                );
              })()}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const order = selectedInvoiceOrder!;
                    const cust = customers.find(c => c.id === order.customerId);
                    handleCopyInvoiceText(order, cust!);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                    copiedInvoiceId === selectedInvoiceOrder!.id
                      ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-950 text-zinc-400 border-zinc-850 hover:text-zinc-200"
                  }`}
                >
                  {copiedInvoiceId === selectedInvoiceOrder!.id ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy DM Text</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const order = selectedInvoiceOrder!;
                    const cust = customers.find(c => c.id === order.customerId);
                    if (!order || !cust) return;

                    const ws = workspaces.find(w => w.id === order.workspaceId);
                    const wsName = (ws?.name || "TERMINUS").toUpperCase();
                    const wsNiche = ws?.niche || "Jewelry";
                    
                    const subtotal = order.items.reduce((sum, item) => {
                      const prod = inventory.find(p => p.id === item.productId);
                      return sum + (prod ? prod.price * item.quantity : 0);
                    }, 0);
                    
                    const printWindow = window.open("", "_blank");
                    if (!printWindow) return;
                    
                    const itemsHtml = order.items.map(item => {
                      const prod = inventory.find(p => p.id === item.productId);
                      return `
                        <tr>
                          <td style="padding: 8px; border-bottom: 1px solid #eee;">${prod?.name || 'Unknown'} (${item.productId})</td>
                          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-family: monospace;">${prod?.price || 0} Tk</td>
                          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center; font-family: monospace;">${item.quantity}</td>
                          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-family: monospace;">${(prod?.price || 0) * item.quantity} Tk</td>
                        </tr>
                      `;
                    }).join("");

                    const discountHtml = order.discount > 0 ? `
                      <tr style="color: #ef4444;">
                        <td colspan="3" style="padding: 6px 8px; text-align: right; font-weight: bold;">Discount:</td>
                        <td style="padding: 6px 8px; text-align: right; font-weight: bold; font-family: monospace;">-${order.discount} Tk</td>
                      </tr>
                    ` : "";

                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Invoice - ${order.id}</title>
                          <style>
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 40px; }
                            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1f2937; padding-bottom: 20px; }
                            .title { font-size: 24px; font-weight: bold; letter-spacing: 0.05em; margin: 0; }
                            .meta { text-align: right; }
                            .section { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                            .card { border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px; background: #f9fafb; }
                            .card-title { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: bold; margin-bottom: 8px; letter-spacing: 0.05em; }
                            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                            th { background: #f3f4f6; padding: 10px; font-size: 11px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #e5e7eb; }
                            .totals { width: 100%; display: flex; justify-content: flex-end; margin-top: 25px; }
                            .totals-table { width: 260px; margin-top: 0; }
                            .totals-table td { padding: 6px 8px; font-size: 13px; }
                            .total-row { font-weight: bold; font-size: 14px; background: #111827; color: #ffffff; }
                            .total-row td { color: #10b981 !important; }
                            .footer { margin-top: 60px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <div>
                              <div class="title">${wsName}</div>
                              <div style="font-size: 11px; color: #4b5563; margin-top: 5px;">Premium ${wsNiche} Retailer, Bangladesh</div>
                            </div>
                            <div class="meta">
                              <div style="font-size: 18px; font-weight: bold; color: #111827;">INVOICE</div>
                              <div style="font-size: 12px; margin-top: 4px; font-family: monospace;">Order ID: #${order.id}</div>
                              <div style="font-size: 12px; color: #4b5563; font-family: monospace;">Date: ${order.date}</div>
                            </div>
                          </div>

                          <div class="section">
                            <div class="card">
                              <div class="card-title">Bill To:</div>
                              <div style="font-weight: bold; font-size: 13px; color: #111827;">${cust?.name || 'N/A'}</div>
                              <div style="margin-top: 4px; font-size: 12px;">Contact: ${cust?.phone || 'N/A'}</div>
                              <div style="margin-top: 4px; font-size: 12px;">Location: ${order.shipping === shippingInside ? 'Inside Dhaka' : 'Outside Dhaka'}</div>
                            </div>
                            <div class="card">
                              <div class="card-title">Logistics:</div>
                              <div style="font-size: 12px;">Courier: ${order.courier !== 'None' ? order.courier : 'Not Assigned'}</div>
                              <div style="margin-top: 4px; font-size: 12px;">Status: <strong>${order.status}</strong></div>
                              ${order.tracking ? `<div style="margin-top: 4px; font-size: 12px; font-family: monospace;">Tracking: ${order.tracking}</div>` : ''}
                            </div>
                          </div>

                          <div style="margin-top: 20px; border: 1px solid #e5e7eb; padding: 15px; border-radius: 6px;">
                            <div class="card-title">Delivery Address:</div>
                            <div style="font-size: 12px; line-height: 1.5; color: #374151;">${cust?.address || 'No address provided.'}</div>
                          </div>

                          <table>
                            <thead>
                              <tr>
                                <th style="text-align: left;">Item Details</th>
                                <th style="text-align: right; width: 100px;">Unit Price</th>
                                <th style="text-align: center; width: 60px;">Qty</th>
                                <th style="text-align: right; width: 100px;">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${itemsHtml}
                            </tbody>
                          </table>

                          <div class="totals">
                            <table class="totals-table">
                              <tr>
                                <td style="color: #4b5563;">Subtotal:</td>
                                <td style="text-align: right; font-family: monospace; color: #374151;">${subtotal} Tk</td>
                              </tr>
                              <tr>
                                <td style="color: #4b5563;">Shipping:</td>
                                <td style="text-align: right; font-family: monospace; color: #374151;">+${order.shipping} Tk</td>
                              </tr>
                              ${discountHtml}
                              <tr class="total-row">
                                <td style="padding: 10px 8px;">COD Total:</td>
                                <td style="text-align: right; padding: 10px 8px; font-weight: bold; font-family: monospace;">${order.total} Tk</td>
                              </tr>
                            </table>
                          </div>

                          <div class="footer">
                            <p>Please verify your name, contact, and delivery details on receipt.</p>
                            <p style="font-style: italic; margin-top: 4px;">Your ${wsNiche.toLowerCase()} parcel will be shipped within 24 hours. Thank you! ❤️</p>
                            <p style="font-weight: bold; font-size: 10px; color: #9ca3af; margin-top: 10px; font-family: monospace; letter-spacing: 0.05em;">Powered by Terminus™</p>
                          </div>

                          <script>
                            window.onload = function() {
                              window.print();
                              window.close();
                            };
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="bg-zinc-950 text-zinc-400 border border-zinc-850 hover:text-white font-semibold px-3 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all"
                  title="Print Invoice Slip"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-400" />
                  <span>Print</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const order = selectedInvoiceOrder!;
                    const cust = customers.find(c => c.id === order.customerId);
                    const sub = order.items.reduce((sum, item) => {
                      const prod = inventory.find(p => p.id === item.productId);
                      return sum + (prod ? prod.price * item.quantity : 0);
                    }, 0);
                    // generate & download
                    generateInvoicePdf(order, cust!.name, cust!.phone, cust!.address, cust!.district, sub, order.shipping, order.total);
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-1.5 rounded text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceOrder(null)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold px-4 py-1.5 rounded text-xs transition-all"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
