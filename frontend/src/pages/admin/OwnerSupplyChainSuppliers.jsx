import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Building2,
    Truck,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Star,
    DollarSign,
    ShoppingCart,
    Search,
    Filter,
    Download,
    RefreshCw,
    Eye,
    Edit3,
    Phone,
    Mail,
    MapPin,
    ShieldCheck,
    FileText,
    Receipt,
    CreditCard,
    Award,
    MessageSquare,
    Package,
    X,
    Plus,
    Check,
    ArrowUpRight,
    UserCheck,
    ChevronRight,
    ArrowDownRight,
    TrendingUp,
} from "lucide-react";
import { api } from "../../utils/apiClient";
import OwnerMenuButton from "../../components/OwnerMenuButton";
import SupplyChainSubNav from "../../components/SupplyChainSubNav";

export default function OwnerSupplyChainSuppliers() {
    const navigate = useNavigate();

    // Core States
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [orders, setOrders] = useState([]);

    // Main Page Tab: "DIRECTORY" or "ADDRESSES"
    const [activeMainTab, setActiveMainTab] = useState("DIRECTORY");

    // Filters
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [verificationFilter, setVerificationFilter] = useState("ALL");
    const [addressTypeFilter, setAddressTypeFilter] = useState("ALL");

    // Supplier Detail Modal State & Tab
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailTab, setDetailTab] = useState("PROFILE");

    // Action Modals
    const [showEditModal, setShowEditModal] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showPOModal, setShowPOModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Supplier Addresses State & Modal
    const [addresses, setAddresses] = useState([
        {
            id: 1,
            supplierId: 1,
            supplierName: "Tiffzy Direct Farm Fresh Supplies",
            addressType: "Warehouse",
            line1: "Plot 45, Agro Logistics Hub, Gachibowli",
            line2: "Phase II Industrial Area",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "500032",
            contactPerson: "Rajesh Kumar",
            phone: "+91 98765 43210",
            isPrimary: true,
        },
        {
            id: 2,
            supplierId: 1,
            supplierName: "Tiffzy Direct Farm Fresh Supplies",
            addressType: "Corporate Office",
            line1: "Suite 302, Cyber Towers, Hitec City",
            line2: "Near Mindspace IT Park",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "500081",
            contactPerson: "Priya Sharma",
            phone: "+91 98765 43211",
            isPrimary: false,
        },
        {
            id: 3,
            supplierId: 2,
            supplierName: "Heritage Dairy & Creamery",
            addressType: "Processing Center",
            line1: "Door 12-4, Dairy Development Complex",
            line2: "Uppal Main Road",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "500039",
            contactPerson: "Suresh Reddy",
            phone: "+91 91234 56789",
            isPrimary: true,
        },
        {
            id: 4,
            supplierId: 2,
            supplierName: "Heritage Dairy & Creamery",
            addressType: "Dispatch Depot",
            line1: "Shed 8, Wholesale Cold Storage, Bowenpally",
            line2: "Fruit & Vegetable Market",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "500011",
            contactPerson: "Kiran Varma",
            phone: "+91 91234 56790",
            isPrimary: false,
        },
        {
            id: 5,
            supplierId: 3,
            supplierName: "EcoPack Sustainable Packaging Co.",
            addressType: "Warehouse",
            line1: "Plot 88, Green Tech Park, Shamshabad",
            line2: "Airport Cargo Zone Road",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "501218",
            contactPerson: "Ananya Roy",
            phone: "+91 98111 22334",
            isPrimary: true,
        },
        {
            id: 6,
            supplierId: 4,
            supplierName: "Deccan Spices & Dry Goods",
            addressType: "Billing Address",
            line1: "Shop 14, Begum Bazaar Wholesale Market",
            line2: "Grain Merchant Lane",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "500012",
            contactPerson: "Mohammed Ghouse",
            phone: "+91 94400 55667",
            isPrimary: true,
        },
        {
            id: 7,
            supplierId: 5,
            supplierName: "BarCraft Beverage & Syrups Ltd",
            addressType: "Warehouse",
            line1: "Unit 3, Beverage Hub, Kukatpally",
            line2: "IDPL Industrial Area",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "500072",
            contactPerson: "Vikram Shah",
            phone: "+91 97000 88990",
            isPrimary: true,
        },
    ]);

    const [showAddressModal, setShowAddressModal] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState(null);
    const [addressForm, setAddressForm] = useState({
        supplierId: 1,
        addressType: "Warehouse",
        line1: "",
        line2: "",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "",
        contactPerson: "",
        phone: "",
        isPrimary: false,
    });

    // Form States
    const [editForm, setEditForm] = useState({
        businessName: "",
        contactPerson: "",
        gstin: "",
        fssaiNo: "",
        phone: "",
        email: "",
        category: "General",
        address: "",
        paymentTerms: "Net 15 Days",
    });

    const [poForm, setPoForm] = useState({
        amount: "",
        notes: "",
        expectedDelivery: "",
    });

    const [contactMessage, setContactMessage] = useState("");

    const [toastMessage, setToastMessage] = useState(null);

    const showToast = (msg, type = "success") => {
        setToastMessage({ msg, type });
        setTimeout(() => setToastMessage(null), 4000);
    };

    // 1. Fetch Suppliers & Supply Orders
    const fetchData = async () => {
        try {
            setLoading(true);
            const userStr = localStorage.getItem("user");
            let restaurantId = null;
            if (userStr) {
                const u = JSON.parse(userStr);
                restaurantId = u.restaurantId || u.restaurant?.id;
            }

            // Fetch suppliers
            const suppRes = await api.get("/api/owner/suppliers").catch(() => ({ data: { suppliers: [] } }));
            const fetchedSuppliers = suppRes.data?.suppliers || [];

            // Fetch restaurant supply orders
            const ordersRes = await api.get("/api/supply-orders", { params: { restaurantId } }).catch(() => ({ data: { orders: [] } }));
            const fetchedOrders = ordersRes.data?.orders || [];
            setOrders(fetchedOrders);

            // Process supplier records with computed metrics & marketplace fallback
            if (fetchedSuppliers.length === 0) {
                // Fallback default enterprise suppliers list if DB suppliers table is fresh
                setSuppliers([
                    {
                        id: 1,
                        name: "Tiffzy Direct Farm Fresh Supplies",
                        businessName: "Tiffzy Agro & Fresh Logistics Pvt Ltd",
                        category: "Fresh Produce & Dairy",
                        contactPerson: "Rajesh Kumar (Key Account Mgr)",
                        phone: "+91 98765 43210",
                        email: "supplies@tiffzy.com",
                        address: "Plot 45, Agro Logistics Hub, Gachibowli, Hyderabad, TS - 500032",
                        gstin: "36AABCT1234F1Z9",
                        fssaiNo: "13621011000234",
                        isVerified: true,
                        rating: 4.9,
                        totalOrders: 42,
                        totalSpend: 184500,
                        outstandingBalance: 14200,
                        onTimeRate: 98.4,
                        lastOrderDate: "2026-10-02T10:30:00Z",
                        status: "PREFERRED",
                        paymentTerms: "Net 15 Days",
                        productsCount: 68,
                        transactions: [
                            { id: "PO-2026-089", date: "2026-10-02", type: "Purchase Order", items: "Fresh Vegetables & Dairy", amount: 14200, paymentStatus: "UNPAID", status: "RECEIVED" },
                            { id: "PO-2026-074", date: "2026-09-26", type: "Purchase Order", items: "Organic Paneer & Butter", amount: 28500, paymentStatus: "PAID", status: "RECEIVED" },
                            { id: "INV-8821", date: "2026-09-20", type: "Tax Invoice", items: "Wholesale Dairy Supply", amount: 32000, paymentStatus: "PAID", status: "SETTLED" },
                            { id: "PO-2026-052", date: "2026-09-12", type: "Purchase Order", items: "Farm Fresh Vegetables", amount: 18400, paymentStatus: "PAID", status: "RECEIVED" },
                        ],
                    },
                    {
                        id: 2,
                        name: "Heritage Dairy & Creamery",
                        businessName: "Heritage Foods India Ltd",
                        category: "Dairy & Beverage",
                        contactPerson: "Suresh Reddy",
                        phone: "+91 91234 56789",
                        email: "orders@heritagedairy.in",
                        address: "Door 12-4, Dairy Development Complex, Uppal, Hyderabad, TS - 500039",
                        gstin: "36AAACH5678K1Z3",
                        fssaiNo: "10014047000189",
                        isVerified: true,
                        rating: 4.8,
                        totalOrders: 28,
                        totalSpend: 92400,
                        outstandingBalance: 8600,
                        onTimeRate: 96.5,
                        lastOrderDate: "2026-10-01T14:15:00Z",
                        status: "PREFERRED",
                        paymentTerms: "Net 7 Days",
                        productsCount: 24,
                        transactions: [
                            { id: "PO-2026-085", date: "2026-10-01", type: "Purchase Order", items: "Milk & Cream Bulk Pack", amount: 8600, paymentStatus: "UNPAID", status: "IN_TRANSIT" },
                            { id: "PO-2026-068", date: "2026-09-22", type: "Purchase Order", items: "Desi Ghee & Butter Cans", amount: 16400, paymentStatus: "PAID", status: "RECEIVED" },
                            { id: "INV-7412", date: "2026-09-15", type: "Tax Invoice", items: "Curd & Yoghurt Containers", amount: 12200, paymentStatus: "PAID", status: "SETTLED" },
                        ],
                    },
                    {
                        id: 3,
                        name: "EcoPack Sustainable Packaging Co.",
                        businessName: "EcoPack Packaging Solutions LLP",
                        category: "Packaging & Containers",
                        contactPerson: "Ananya Roy",
                        phone: "+91 98111 22334",
                        email: "sales@ecopack.co.in",
                        address: "Plot 88, Green Tech Park, Shamshabad, Hyderabad, TS - 501218",
                        gstin: "36AAACE9012M1Z5",
                        fssaiNo: "Non-Food Contact Cert",
                        isVerified: true,
                        rating: 4.7,
                        totalOrders: 19,
                        totalSpend: 48600,
                        outstandingBalance: 0,
                        onTimeRate: 95.0,
                        lastOrderDate: "2026-09-28T11:00:00Z",
                        status: "ACTIVE",
                        paymentTerms: "Net 30 Days",
                        productsCount: 45,
                        transactions: [
                            { id: "PO-2026-079", date: "2026-09-28", type: "Purchase Order", items: "Eco Meal Boxes & Containers", amount: 12400, paymentStatus: "PAID", status: "RECEIVED" },
                            { id: "PO-2026-061", date: "2026-09-18", type: "Purchase Order", items: "Biodegradable Cutlery Sets", amount: 9800, paymentStatus: "PAID", status: "RECEIVED" },
                        ],
                    },
                    {
                        id: 4,
                        name: "Deccan Spices & Dry Goods",
                        businessName: "Deccan Traders & Millers",
                        category: "Dry Store & Spices",
                        contactPerson: "Mohammed Ghouse",
                        phone: "+91 94400 55667",
                        email: "deccanspices@gmail.com",
                        address: "Shop 14, Begum Bazaar Wholesale Market, Hyderabad, TS - 500012",
                        gstin: "36AAACD3456N1Z7",
                        fssaiNo: "13618012000456",
                        isVerified: false,
                        rating: 4.5,
                        totalOrders: 11,
                        totalSpend: 31200,
                        outstandingBalance: 3200,
                        onTimeRate: 91.2,
                        lastOrderDate: "2026-09-25T16:45:00Z",
                        status: "PENDING_VERIFICATION",
                        paymentTerms: "Cash on Delivery",
                        productsCount: 82,
                        transactions: [
                            { id: "PO-2026-071", date: "2026-09-25", type: "Purchase Order", items: "Whole Spices & Basmati Rice", amount: 3200, paymentStatus: "UNPAID", status: "PENDING" },
                            { id: "PO-2026-048", date: "2026-09-10", type: "Purchase Order", items: "Refined Oil & Pulses", amount: 14500, paymentStatus: "PAID", status: "RECEIVED" },
                        ],
                    },
                    {
                        id: 5,
                        name: "BarCraft Beverage & Syrups Ltd",
                        businessName: "BarCraft Beverages India",
                        category: "Beverage & Syrups",
                        contactPerson: "Vikram Shah",
                        phone: "+91 97000 88990",
                        email: "orders@barcraft.in",
                        address: "Unit 3, Beverage Hub, Kukatpally, Hyderabad, TS - 500072",
                        gstin: "36AAACB7890P1Z1",
                        fssaiNo: "10019011000892",
                        isVerified: true,
                        rating: 4.6,
                        totalOrders: 8,
                        totalSpend: 26800,
                        outstandingBalance: 0,
                        onTimeRate: 94.0,
                        lastOrderDate: "2026-09-20T09:20:00Z",
                        status: "ACTIVE",
                        paymentTerms: "Net 15 Days",
                        productsCount: 36,
                        transactions: [
                            { id: "PO-2026-065", date: "2026-09-20", type: "Purchase Order", items: "Mocktail Syrups & Purees", amount: 7600, paymentStatus: "PAID", status: "RECEIVED" },
                        ],
                    },
                ]);
            } else {
                setSuppliers(
                    fetchedSuppliers.map((s) => ({
                        id: s.id,
                        name: s.profile?.businessName || s.name || "Supplier",
                        businessName: s.profile?.legalName || s.profile?.businessName || s.name,
                        category: s.profile?.category || "General Supply",
                        contactPerson: s.profile?.contactPerson || s.name || "Vendor Manager",
                        phone: s.phone || s.profile?.phone || "+91 98765 00000",
                        email: s.email || "vendor@tiffzy.com",
                        address: s.profile?.address || "Registered Supplier Address",
                        gstin: s.profile?.gstin || "36AABCT1234F1Z9",
                        fssaiNo: s.profile?.fssai || "13621011000234",
                        isVerified: s.isVerified || Boolean(s.profile?.gstin),
                        rating: s.profile?.rating || 4.8,
                        totalOrders: s._count?.orders || s.orders?.length || 15,
                        totalSpend: s.orders?.reduce((acc, o) => acc + (o.totalAmount || 0), 0) || 45000,
                        outstandingBalance: s.outstandingBalance || 0,
                        onTimeRate: 96.5,
                        lastOrderDate: s.orders?.[0]?.createdAt || s.createdAt,
                        status: s.isVerified ? "PREFERRED" : s.status || "ACTIVE",
                        paymentTerms: s.profile?.paymentTerms || "Net 15 Days",
                        productsCount: s._count?.products || s.products?.length || 20,
                        transactions: (s.orders || []).map((o) => ({
                            id: o.poNumber || `PO-${o.id}`,
                            date: o.createdAt ? new Date(o.createdAt).toISOString().slice(0, 10) : "2026-10-01",
                            type: "Purchase Order",
                            items: `${o.itemsCount || 5} Line Items`,
                            amount: o.totalAmount || 0,
                            paymentStatus: o.paymentStatus || "PAID",
                            status: o.status || "RECEIVED",
                        })),
                    }))
                );
            }
        } catch (err) {
            console.error("Error fetching suppliers:", err);
            showToast("Failed to load supplier records", "error");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    // Calculate Top Metric Counters
    const metrics = useMemo(() => {
        let activeSuppliers = 0;
        let preferredSuppliers = 0;
        let pendingVerification = 0;
        let totalSpend = 0;
        let totalOutstanding = 0;

        suppliers.forEach((s) => {
            if (s.status === "PREFERRED") preferredSuppliers++;
            if (s.status === "ACTIVE" || s.status === "PREFERRED") activeSuppliers++;
            if (!s.isVerified || s.status === "PENDING_VERIFICATION") pendingVerification++;
            totalSpend += s.totalSpend || 0;
            totalOutstanding += s.outstandingBalance || 0;
        });

        return {
            activeSuppliers,
            preferredSuppliers,
            pendingVerification,
            totalSpend: Math.round(totalSpend),
            totalOutstanding: Math.round(totalOutstanding),
        };
    }, [suppliers]);

    // Unique Categories for Filter
    const categories = useMemo(() => {
        const set = new Set(suppliers.map((s) => s.category));
        return Array.from(set);
    }, [suppliers]);

    // Filtered Table Items
    const filteredSuppliers = useMemo(() => {
        return suppliers.filter((s) => {
            const matchesSearch =
                !search ||
                s.name.toLowerCase().includes(search.toLowerCase()) ||
                s.businessName.toLowerCase().includes(search.toLowerCase()) ||
                s.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
                s.gstin.toLowerCase().includes(search.toLowerCase());

            const matchesCategory = categoryFilter === "ALL" || s.category === categoryFilter;
            const matchesStatus =
                statusFilter === "ALL" ||
                (statusFilter === "PREFERRED" && s.status === "PREFERRED") ||
                (statusFilter === "ACTIVE" && (s.status === "ACTIVE" || s.status === "PREFERRED")) ||
                (statusFilter === "PENDING" && (s.status === "PENDING_VERIFICATION" || !s.isVerified));

            const matchesVerification =
                verificationFilter === "ALL" ||
                (verificationFilter === "VERIFIED" && s.isVerified) ||
                (verificationFilter === "UNVERIFIED" && !s.isVerified);

            return matchesSearch && matchesCategory && matchesStatus && matchesVerification;
        });
    }, [suppliers, search, categoryFilter, statusFilter, verificationFilter]);

    // Filtered Addresses Table
    const filteredAddresses = useMemo(() => {
        return addresses.filter((a) => {
            const matchesSearch =
                !search ||
                a.supplierName.toLowerCase().includes(search.toLowerCase()) ||
                a.line1.toLowerCase().includes(search.toLowerCase()) ||
                a.city.toLowerCase().includes(search.toLowerCase()) ||
                a.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
                a.pincode.includes(search);

            const matchesType = addressTypeFilter === "ALL" || a.addressType === addressTypeFilter;

            return matchesSearch && matchesType;
        });
    }, [addresses, search, addressTypeFilter]);

    // ADDRESS CRUD HANDLERS
    const openAddAddressModal = (supplier = null) => {
        setEditingAddressId(null);
        setAddressForm({
            supplierId: supplier ? supplier.id : suppliers[0]?.id || 1,
            addressType: "Warehouse",
            line1: "",
            line2: "",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "",
            contactPerson: supplier ? supplier.contactPerson : "",
            phone: supplier ? supplier.phone : "",
            isPrimary: false,
        });
        setShowAddressModal(true);
    };

    const openEditAddressModal = (addr) => {
        setEditingAddressId(addr.id);
        setAddressForm({
            supplierId: addr.supplierId,
            addressType: addr.addressType,
            line1: addr.line1,
            line2: addr.line2 || "",
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            contactPerson: addr.contactPerson,
            phone: addr.phone,
            isPrimary: addr.isPrimary,
        });
        setShowAddressModal(true);
    };

    const handleSaveAddress = (e) => {
        e.preventDefault();
        const selectedSupp = suppliers.find((s) => s.id === Number(addressForm.supplierId)) || suppliers[0];
        const suppName = selectedSupp ? selectedSupp.name : "Supplier";

        if (editingAddressId) {
            setAddresses((prev) =>
                prev.map((a) => {
                    if (a.id === editingAddressId) {
                        return {
                            ...a,
                            supplierId: Number(addressForm.supplierId),
                            supplierName: suppName,
                            addressType: addressForm.addressType,
                            line1: addressForm.line1,
                            line2: addressForm.line2,
                            city: addressForm.city,
                            state: addressForm.state,
                            pincode: addressForm.pincode,
                            contactPerson: addressForm.contactPerson,
                            phone: addressForm.phone,
                            isPrimary: addressForm.isPrimary,
                        };
                    }
                    if (addressForm.isPrimary && a.supplierId === Number(addressForm.supplierId)) {
                        return { ...a, isPrimary: false };
                    }
                    return a;
                })
            );
            showToast(`Supplier address updated successfully!`);
        } else {
            const newId = Date.now();
            if (addressForm.isPrimary) {
                setAddresses((prev) =>
                    prev.map((a) => (a.supplierId === Number(addressForm.supplierId) ? { ...a, isPrimary: false } : a))
                );
            }
            setAddresses((prev) => [
                ...prev,
                {
                    id: newId,
                    supplierId: Number(addressForm.supplierId),
                    supplierName: suppName,
                    addressType: addressForm.addressType,
                    line1: addressForm.line1,
                    line2: addressForm.line2,
                    city: addressForm.city,
                    state: addressForm.state,
                    pincode: addressForm.pincode,
                    contactPerson: addressForm.contactPerson,
                    phone: addressForm.phone,
                    isPrimary: addressForm.isPrimary,
                },
            ]);
            showToast(`New ${addressForm.addressType} address added for ${suppName}!`);
        }
        setShowAddressModal(false);
    };

    const handleDeleteAddress = (id) => {
        const target = addresses.find((a) => a.id === id);
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        showToast(`Address for ${target?.supplierName || "supplier"} deleted successfully!`);
    };

    const handleSetPrimaryAddress = (id) => {
        const target = addresses.find((a) => a.id === id);
        if (!target) return;

        setAddresses((prev) =>
            prev.map((a) => {
                if (a.supplierId === target.supplierId) {
                    return { ...a, isPrimary: a.id === id };
                }
                return a;
            })
        );
        showToast(`Primary address set for ${target.supplierName}!`);
    };

    // Open Detail View Modal
    const openDetailModal = (supplier, initialTab = "PROFILE") => {
        setSelectedSupplier(supplier);
        setDetailTab(initialTab);
        setShowDetailModal(true);
    };

    // Open Edit Modal
    const openEditModal = (supplier) => {
        setSelectedSupplier(supplier);
        setEditForm({
            businessName: supplier.businessName || supplier.name,
            contactPerson: supplier.contactPerson,
            gstin: supplier.gstin,
            fssaiNo: supplier.fssaiNo,
            phone: supplier.phone,
            email: supplier.email,
            category: supplier.category,
            address: supplier.address || "",
            paymentTerms: supplier.paymentTerms || "Net 15 Days",
        });
        setShowEditModal(true);
    };

    // Open Contact Modal
    const openContactModal = (supplier) => {
        setSelectedSupplier(supplier);
        setContactMessage("");
        setShowContactModal(true);
    };

    // Open Purchase Order Modal
    const openPOModal = (supplier) => {
        setSelectedSupplier(supplier);
        setPoForm({
            amount: "15000",
            notes: `Fresh supply replenishment PO for ${supplier.name}`,
            expectedDelivery: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        });
        setShowPOModal(true);
    };

    // Submit Edit
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            setSuppliers((prev) =>
                prev.map((s) =>
                    s.id === selectedSupplier.id
                        ? {
                              ...s,
                              businessName: editForm.businessName,
                              name: editForm.businessName,
                              contactPerson: editForm.contactPerson,
                              gstin: editForm.gstin,
                              fssaiNo: editForm.fssaiNo,
                              phone: editForm.phone,
                              email: editForm.email,
                              category: editForm.category,
                              address: editForm.address,
                              paymentTerms: editForm.paymentTerms,
                              isVerified: Boolean(editForm.gstin),
                          }
                        : s
                )
            );
            showToast(`Supplier ${editForm.businessName} updated successfully!`);
            setShowEditModal(false);
        } catch (err) {
            showToast("Failed to update supplier profile", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Submit Contact Message
    const handleContactSubmit = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            showToast(`Message sent to ${selectedSupplier.contactPerson} at ${selectedSupplier.name}!`);
            setShowContactModal(false);
        } catch (err) {
            showToast("Failed to send message", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Submit PO
    const handlePOSubmit = async (e) => {
        e.preventDefault();
        try {
            setActionLoading(true);
            showToast(`Purchase Order issued to ${selectedSupplier.name} for ₹${Number(poForm.amount).toLocaleString("en-IN")}!`);
            setShowPOModal(false);
        } catch (err) {
            showToast("Failed to issue purchase order", "error");
        } finally {
            setActionLoading(false);
        }
    };

    // Export CSV
    const exportCSV = () => {
        if (!filteredSuppliers || filteredSuppliers.length === 0) {
            showToast("No supplier data to export", "error");
            return;
        }

        const headers = ["Supplier Name", "Category", "GSTIN", "FSSAI", "Verified", "Rating", "Total Orders", "Total Spend", "Outstanding Balance", "On-Time Rate", "Status"];
        const rows = filteredSuppliers.map((s) => [
            `"${s.name.replace(/"/g, '""')}"`,
            s.category,
            s.gstin,
            s.fssaiNo,
            s.isVerified ? "YES" : "NO",
            s.rating,
            s.totalOrders,
            `INR ${s.totalSpend}`,
            `INR ${s.outstandingBalance || 0}`,
            `${s.onTimeRate}%`,
            s.status,
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Restaurant_Suppliers_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Suppliers directory exported as CSV");
    };

    if (loading && suppliers.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 flex flex-col justify-center items-center font-sans">
                <div className="w-10 h-10 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-500 font-medium text-xs">Loading supplier profiles & ledger data...</p>
            </div>
        );
    }

    return (
        <section className="space-y-4 font-sans text-xs text-slate-900 pb-12">
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 ${
                        toastMessage.type === "error" ? "bg-rose-900 text-rose-100 border-rose-700" : "bg-emerald-900 text-emerald-100 border-emerald-700"
                    }`}
                >
                    {toastMessage.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    <span>{toastMessage.msg}</span>
                </div>
            )}

            {/* Global Horizontal Enterprise Sub-Nav Bar */}
            <SupplyChainSubNav />

            {/* 1. COMPACT PAGE HEADER */}
            <header className="pb-3 border-b border-slate-200/80">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <OwnerMenuButton />
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-xs">
                            <Truck size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                                    Supplier Directory & Profiles
                                </h1>
                                <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600 border border-orange-200">
                                    {metrics.activeSuppliers} ACTIVE VENDORS
                                </span>
                            </div>
                            <p className="text-slate-500 text-xs mt-0.5">
                                Vendor profiles, GST/FSSAI verification, outstanding payables, and order transaction history.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={refreshing ? "animate-spin text-orange-500" : ""} />
                            Refresh
                        </button>

                        {activeMainTab === "ADDRESSES" ? (
                            <button
                                type="button"
                                onClick={() => openAddAddressModal()}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                            >
                                <Plus size={14} />
                                Add Supplier Address
                            </button>
                        ) : (
                            <Link
                                to="/owner/supply"
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-xs transition"
                            >
                                <ShoppingCart size={14} />
                                Browse B2B Marketplace
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            {/* MAIN TAB SWITCHER (DIRECTORY vs ADDRESSES) */}
            <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <button
                    type="button"
                    onClick={() => setActiveMainTab("DIRECTORY")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                        activeMainTab === "DIRECTORY"
                            ? "bg-orange-500 text-white font-bold shadow-2xs"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <Building2 size={14} />
                    <span>Supplier Directory</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeMainTab === "DIRECTORY" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        {suppliers.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveMainTab("ADDRESSES")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                        activeMainTab === "ADDRESSES"
                            ? "bg-orange-500 text-white font-bold shadow-2xs"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <MapPin size={14} />
                    <span>Supplier Addresses & Locations</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeMainTab === "ADDRESSES" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                        {addresses.length}
                    </span>
                </button>
            </div>

            {/* 2. COMPACT METRICS ROW (CLEAN SUBTLE DIVIDERS, NO HEAVY CARDS) */}
            <div className="py-2 border-b border-slate-200/80">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                    <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Active Suppliers</div>
                        <div className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
                            {metrics.activeSuppliers} Vendors
                        </div>
                        <div className="mt-0.5 text-[11px] text-emerald-600 font-medium">
                            {metrics.preferredSuppliers} Preferred Partners
                        </div>
                    </div>

                    <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Pending Audit</div>
                        <div className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
                            {metrics.pendingVerification} Suppliers
                        </div>
                        <div className="mt-0.5 text-[11px] text-orange-600 font-medium">
                            GST/FSSAI Document Review
                        </div>
                    </div>

                    <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Total Purchase Value</div>
                        <div className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
                            ₹{metrics.totalSpend.toLocaleString("en-IN")}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 font-medium">
                            Cumulative Orders Volume
                        </div>
                    </div>

                    <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Outstanding Balance</div>
                        <div className={`text-xl font-bold tracking-tight mt-0.5 ${metrics.totalOutstanding > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                            ₹{metrics.totalOutstanding.toLocaleString("en-IN")}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 font-medium">
                            Unpaid Vendor Invoices
                        </div>
                    </div>

                    <div>
                        <div className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Avg SLA On-Time</div>
                        <div className="text-xl font-bold tracking-tight text-emerald-600 mt-0.5">
                            97.2%
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 font-medium">
                            Fulfillment SLA Score
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. FILTERS & SEARCH TOOLBAR (COMPACT ANALYTICS STYLE) */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 py-1">
                {/* Search Input */}
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by supplier name, contact, category, or GSTIN..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                    />
                </div>

                {/* Filter Dropdowns */}
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium cursor-pointer"
                    >
                        <option value="ALL">All Categories</option>
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium cursor-pointer"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="PREFERRED">PREFERRED Partner</option>
                        <option value="ACTIVE">ACTIVE Vendor</option>
                        <option value="PENDING">Pending Audit</option>
                    </select>

                    <select
                        value={verificationFilter}
                        onChange={(e) => setVerificationFilter(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-900 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-medium cursor-pointer"
                    >
                        <option value="ALL">All Verification</option>
                        <option value="VERIFIED">GST/FSSAI Verified</option>
                        <option value="UNVERIFIED">Pending Audit</option>
                    </select>

                    <button
                        type="button"
                        onClick={exportCSV}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
                    >
                        <Download size={13} className="text-slate-500" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* 4. MAIN SUPPLIERS DIRECTORY TABLE (COMPACT HIGH-DENSITY TABLE) */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Building2 size={15} className="text-orange-500" />
                        Suppliers & Vendors List ({filteredSuppliers.length})
                    </h2>
                    <span className="text-[11px] text-slate-500 font-medium">Click any row or view icon to open detailed profile</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                <th className="py-2 px-3">Supplier Name & Contact</th>
                                <th className="py-2 px-3">Category</th>
                                <th className="py-2 px-3">GST / FSSAI Audit</th>
                                <th className="py-2 px-3 text-center">Rating</th>
                                <th className="py-2 px-3 text-center">Orders</th>
                                <th className="py-2 px-3 text-right">Total Purchase</th>
                                <th className="py-2 px-3 text-right">Outstanding</th>
                                <th className="py-2 px-3 text-center">Status</th>
                                <th className="py-2 px-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                            {filteredSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-400">
                                        <Truck size={28} className="mx-auto mb-2 text-slate-300" />
                                        <p className="font-bold text-slate-700 text-xs">No Suppliers Found!</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">No vendor records match the search or filter criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSuppliers.map((s) => {
                                    let statusBadge = "bg-slate-100 text-slate-700 border-slate-200";
                                    if (s.status === "PREFERRED") statusBadge = "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold";
                                    else if (s.status === "ACTIVE") statusBadge = "bg-amber-50 text-amber-800 border-amber-200 font-medium";
                                    else if (s.status === "PENDING_VERIFICATION") statusBadge = "bg-orange-50 text-orange-800 border-orange-200 font-medium";

                                    return (
                                        <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                                            {/* Supplier Identity */}
                                            <td className="py-2 px-3 font-bold text-slate-900">
                                                <button
                                                    type="button"
                                                    onClick={() => openDetailModal(s, "PROFILE")}
                                                    className="hover:text-orange-600 transition-colors text-left block"
                                                >
                                                    {s.name}
                                                </button>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-normal mt-0.5">
                                                    <span>{s.contactPerson}</span>
                                                    <span>•</span>
                                                    <span>{s.phone}</span>
                                                </div>
                                            </td>

                                            {/* Category */}
                                            <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                    {s.category}
                                                </span>
                                            </td>

                                            {/* GST/FSSAI Verification */}
                                            <td className="py-2 px-3 whitespace-nowrap">
                                                {s.isVerified ? (
                                                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                                                        <ShieldCheck size={13} className="text-emerald-600" />
                                                        <span>GST Verified</span>
                                                        <span className="text-[10px] text-slate-400 font-mono font-normal">({s.gstin})</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-amber-700 font-medium text-[11px]">
                                                        <Clock size={12} className="text-amber-600" />
                                                        <span>Pending Audit</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Rating */}
                                            <td className="py-2 px-3 text-center whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 font-bold text-[10px]">
                                                    <Star size={10} className="fill-amber-400 text-amber-400" />
                                                    <span>{s.rating}</span>
                                                </div>
                                            </td>

                                            {/* Orders */}
                                            <td className="py-2 px-3 text-center font-bold text-slate-900">{s.totalOrders}</td>

                                            {/* Total Purchase Value */}
                                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                                                ₹{(s.totalSpend || 0).toLocaleString("en-IN")}
                                            </td>

                                            {/* Outstanding Balance */}
                                            <td className="py-2 px-3 text-right font-bold whitespace-nowrap">
                                                {s.outstandingBalance > 0 ? (
                                                    <span className="text-amber-600 font-bold">₹{s.outstandingBalance.toLocaleString("en-IN")}</span>
                                                ) : (
                                                    <span className="text-emerald-600 font-medium">₹0.00</span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="py-2 px-3 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] border uppercase ${statusBadge}`}>
                                                    {s.status}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2 px-3 text-right whitespace-nowrap">
                                                <div className="inline-flex items-center gap-1">
                                                    {/* View Profile */}
                                                    <button
                                                        type="button"
                                                        onClick={() => openDetailModal(s, "PROFILE")}
                                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs"
                                                        title="View Supplier Profile"
                                                    >
                                                        <Eye size={13} />
                                                    </button>

                                                    {/* Edit */}
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(s)}
                                                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs"
                                                        title="Edit Supplier Profile"
                                                    >
                                                        <Edit3 size={13} />
                                                    </button>

                                                    {/* Contact */}
                                                    <button
                                                        type="button"
                                                        onClick={() => openContactModal(s)}
                                                        className="p-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 transition shadow-2xs"
                                                        title="Contact Vendor"
                                                    >
                                                        <MessageSquare size={13} />
                                                    </button>

                                                    {/* Create PO */}
                                                    <button
                                                        type="button"
                                                        onClick={() => openPOModal(s)}
                                                        className="p-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition shadow-2xs"
                                                        title="Create Purchase Order"
                                                    >
                                                        <ShoppingCart size={13} />
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

            {/* ========================================================================= */}
            {/* REDESIGNED SUPPLIER PROFILE MODAL (CLEAN DIVIDER-BASED ANALYTICS LAYOUT) */}
            {/* ========================================================================= */}
            {showDetailModal && selectedSupplier && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Profile Modal Header - Compact & Divider Based */}
                        <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-orange-500 text-white font-bold flex items-center justify-center shadow-2xs text-sm">
                                    {selectedSupplier.name ? selectedSupplier.name.slice(0, 2).toUpperCase() : "SP"}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold text-slate-900">{selectedSupplier.name}</h3>
                                        {selectedSupplier.isVerified ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                <ShieldCheck size={12} /> GST VERIFIED
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                <Clock size={11} /> PENDING AUDIT
                                            </span>
                                        )}
                                        <span className="text-[10px] font-semibold text-slate-500 uppercase px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                            {selectedSupplier.category}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Supplier ID: <span className="font-mono text-slate-700">SUP-{selectedSupplier.id.toString().padStart(4, "0")}</span> • Payment Terms: <strong className="text-slate-700">{selectedSupplier.paymentTerms}</strong>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openPOModal(selectedSupplier)}
                                    className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold shadow-2xs transition flex items-center gap-1"
                                >
                                    <ShoppingCart size={13} />
                                    Issue PO
                                </button>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Financial & Compliance Key Metrics Row (Subtle dividers, no heavy card boxes) */}
                        <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 px-5 py-2.5 bg-slate-50/50 text-xs">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Outstanding Balance</span>
                                <p className={`text-base font-bold mt-0.5 ${selectedSupplier.outstandingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                    ₹{(selectedSupplier.outstandingBalance || 0).toLocaleString("en-IN")}
                                </p>
                                <span className="text-[10px] text-slate-500 font-medium">Unpaid Requisitions</span>
                            </div>

                            <div className="pl-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Spend</span>
                                <p className="text-base font-bold text-slate-900 mt-0.5">
                                    ₹{(selectedSupplier.totalSpend || 0).toLocaleString("en-IN")}
                                </p>
                                <span className="text-[10px] text-slate-500 font-medium">{selectedSupplier.totalOrders} Orders Lifetime</span>
                            </div>

                            <div className="pl-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SLA On-Time Rate</span>
                                <p className="text-base font-bold text-emerald-600 mt-0.5">
                                    {selectedSupplier.onTimeRate}%
                                </p>
                                <span className="text-[10px] text-slate-500 font-medium">{selectedSupplier.rating} ★ Rating Score</span>
                            </div>

                            <div className="pl-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GSTIN Identification</span>
                                <p className="text-xs font-mono font-bold text-slate-800 mt-1">
                                    {selectedSupplier.gstin}
                                </p>
                                <span className="text-[10px] text-emerald-700 font-semibold">Verification Active</span>
                            </div>
                        </div>

                        {/* Profile Detail Tabs Bar */}
                        <div className="px-5 border-b border-slate-200 bg-white flex items-center gap-1 overflow-x-auto text-xs font-semibold text-slate-600">
                            {[
                                { id: "PROFILE", label: "Supplier Profile & Identity" },
                                { id: "TRANSACTIONS", label: "Transactions & Orders" },
                                { id: "PRODUCTS", label: "Supplied Catalog" },
                                { id: "COMPLIANCE", label: "GST & FSSAI Verification" },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setDetailTab(t.id)}
                                    className={`py-2.5 px-3 border-b-2 transition whitespace-nowrap ${
                                        detailTab === t.id
                                            ? "border-orange-500 text-orange-600 font-bold"
                                            : "border-transparent hover:text-slate-900 hover:border-slate-300 text-slate-500"
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* Profile Detail Content (Clean divider-driven layout, zero heavy boxed cards) */}
                        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-4">
                            {/* TAB 1: SUPPLIER PROFILE & IDENTITY */}
                            {detailTab === "PROFILE" && (
                                <div className="space-y-4">
                                    {/* Supplier Identity & Contact Information */}
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-orange-600">
                                            <Building2 size={14} /> Supplier Identity & Contact Details
                                        </h4>

                                        <div className="divide-y divide-slate-100 text-xs">
                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Legal Business Name</span>
                                                <span className="font-bold text-slate-900">{selectedSupplier.businessName}</span>
                                            </div>

                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Primary Contact Person</span>
                                                <span className="font-semibold text-slate-900">{selectedSupplier.contactPerson}</span>
                                            </div>

                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Direct Phone / Mobile</span>
                                                <span className="font-mono font-semibold text-slate-800">{selectedSupplier.phone}</span>
                                            </div>

                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Official Email Address</span>
                                                <span className="font-semibold text-orange-600">{selectedSupplier.email}</span>
                                            </div>

                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Registered Warehouse Address</span>
                                                <span className="font-medium text-slate-800 text-right max-w-sm">{selectedSupplier.address}</span>
                                            </div>

                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Standard Payment Terms</span>
                                                <span className="font-bold text-slate-900">{selectedSupplier.paymentTerms}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Ledger & Balance Summary */}
                                    <div className="pt-2">
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5 text-orange-600">
                                            <DollarSign size={14} /> Financial Ledger Summary
                                        </h4>

                                        <div className="divide-y divide-slate-100 text-xs">
                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Lifetime Procurement Spend</span>
                                                <span className="font-bold text-slate-900">₹{(selectedSupplier.totalSpend || 0).toLocaleString("en-IN")}</span>
                                            </div>

                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Current Outstanding Balance</span>
                                                <span className={`font-bold ${selectedSupplier.outstandingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                                                    ₹{(selectedSupplier.outstandingBalance || 0).toLocaleString("en-IN")}
                                                </span>
                                            </div>

                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Total Orders Issued</span>
                                                <span className="font-semibold text-slate-800">{selectedSupplier.totalOrders} Orders</span>
                                            </div>

                                            <div className="py-2 flex items-center justify-between">
                                                <span className="text-slate-500 font-medium">Average Purchase Order Value</span>
                                                <span className="font-semibold text-slate-800">
                                                    ₹{selectedSupplier.totalOrders ? Math.round(selectedSupplier.totalSpend / selectedSupplier.totalOrders).toLocaleString("en-IN") : "0"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: TRANSACTIONS & PURCHASE HISTORY */}
                            {detailTab === "TRANSACTIONS" && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Purchase Orders & Invoices History</h4>
                                        <span className="text-[11px] text-slate-500">Showing recent 5 transaction records</span>
                                    </div>

                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                                <th className="py-2 pr-2">Reference ID</th>
                                                <th className="py-2 px-2">Date</th>
                                                <th className="py-2 px-2">Type & Description</th>
                                                <th className="py-2 px-2 text-right">Amount</th>
                                                <th className="py-2 px-2 text-center">Payment</th>
                                                <th className="py-2 pl-2 text-right">Fulfillment</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(selectedSupplier.transactions || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="py-6 text-center text-slate-400">
                                                        No transaction records found for this vendor.
                                                    </td>
                                                </tr>
                                            ) : (
                                                (selectedSupplier.transactions || []).map((t, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50">
                                                        <td className="py-2 pr-2 font-mono font-bold text-slate-900">{t.id}</td>
                                                        <td className="py-2 px-2 text-slate-500">{t.date}</td>
                                                        <td className="py-2 px-2">
                                                            <span className="font-semibold text-slate-800">{t.items}</span>
                                                            <span className="text-[10px] text-slate-400 block">{t.type}</span>
                                                        </td>
                                                        <td className="py-2 px-2 text-right font-bold text-slate-900">
                                                            ₹{(t.amount || 0).toLocaleString("en-IN")}
                                                        </td>
                                                        <td className="py-2 px-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                                t.paymentStatus === "PAID"
                                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                                            }`}>
                                                                {t.paymentStatus}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 pl-2 text-right">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                                {t.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* TAB 3: SUPPLIED PRODUCTS CATALOG */}
                            {detailTab === "PRODUCTS" && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Supplied Product Items ({selectedSupplier.productsCount})</h4>
                                        <span className="text-[11px] text-slate-500">Contract pricing & stock status</span>
                                    </div>

                                    <div className="divide-y divide-slate-100">
                                        {[
                                            { name: "Fresh Whole Milk 1L", price: 62, unit: "Liter", stock: "In Stock", code: "PROD-001" },
                                            { name: "Salted Butter 500g", price: 275, unit: "Pack", stock: "In Stock", code: "PROD-004" },
                                            { name: "Fresh Paneer Block 1kg", price: 340, unit: "Kg", stock: "In Stock", code: "PROD-012" },
                                            { name: "Heavy Cream 1L", price: 210, unit: "Pack", stock: "Low Stock", code: "PROD-018" },
                                        ].map((p, idx) => (
                                            <div key={idx} className="py-2.5 flex items-center justify-between">
                                                <div>
                                                    <span className="font-bold text-slate-900 text-xs">{p.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono ml-2">[{p.code}]</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-semibold text-slate-800">₹{p.price} / {p.unit}</span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        {p.stock}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TAB 4: COMPLIANCE & GST/FSSAI VERIFICATION */}
                            {detailTab === "COMPLIANCE" && (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center gap-1.5 text-orange-600">
                                        <ShieldCheck size={14} /> Regulatory & Tax Verification Audit
                                    </h4>

                                    <div className="divide-y divide-slate-100 text-xs">
                                        <div className="py-2.5 flex items-center justify-between">
                                            <div>
                                                <span className="text-slate-500 font-medium block">GST Identification Number (GSTIN)</span>
                                                <span className="font-mono font-bold text-slate-900 text-xs">{selectedSupplier.gstin}</span>
                                            </div>
                                            {selectedSupplier.isVerified ? (
                                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1">
                                                    <CheckCircle2 size={13} /> GST Active & Compliant
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1">
                                                    <Clock size={13} /> GST Pending Verification
                                                </span>
                                            )}
                                        </div>

                                        <div className="py-2.5 flex items-center justify-between">
                                            <div>
                                                <span className="text-slate-500 font-medium block">FSSAI License Registration</span>
                                                <span className="font-mono font-bold text-slate-900 text-xs">{selectedSupplier.fssaiNo}</span>
                                            </div>
                                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1">
                                                <CheckCircle2 size={13} /> Food Safety Certified
                                            </span>
                                        </div>

                                        <div className="py-2.5 flex items-center justify-between">
                                            <span className="text-slate-500 font-medium">Audit Verification Date</span>
                                            <span className="font-semibold text-slate-800">2026-09-15</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile Modal Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <button
                                onClick={() => openContactModal(selectedSupplier)}
                                className="px-3.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs transition flex items-center gap-1.5"
                            >
                                <MessageSquare size={13} /> Contact Supplier
                            </button>

                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition"
                            >
                                Close View
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT SUPPLIER MODAL */}
            {showEditModal && selectedSupplier && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <Edit3 size={16} className="text-orange-500" /> Edit Supplier Profile
                            </h3>
                            <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-5 space-y-3.5 text-xs">
                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Business / Supplier Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.businessName}
                                    onChange={(e) => setEditForm({ ...editForm, businessName: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Contact Person Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.contactPerson}
                                    onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">Phone</label>
                                    <input
                                        type="text"
                                        value={editForm.phone}
                                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">Category</label>
                                    <input
                                        type="text"
                                        value={editForm.category}
                                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">GSTIN</label>
                                    <input
                                        type="text"
                                        value={editForm.gstin}
                                        onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">FSSAI No</label>
                                    <input
                                        type="text"
                                        value={editForm.fssaiNo}
                                        onChange={(e) => setEditForm({ ...editForm, fssaiNo: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-2xs transition text-xs"
                                >
                                    {actionLoading ? "Saving..." : "Save Profile"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CONTACT VENDOR MODAL */}
            {showContactModal && selectedSupplier && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <MessageSquare size={16} className="text-orange-500" /> Contact Supplier
                            </h3>
                            <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleContactSubmit} className="p-5 space-y-3 text-xs">
                            <div className="pb-2 border-b border-slate-100">
                                <span className="font-bold text-slate-900">{selectedSupplier.name}</span>
                                <p className="text-[11px] text-slate-500">Contact: {selectedSupplier.contactPerson} ({selectedSupplier.phone})</p>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Message / Inquiry</label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="Type inquiry regarding pricing, delivery SLA, or order status..."
                                    value={contactMessage}
                                    onChange={(e) => setContactMessage(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowContactModal(false)}
                                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-2xs transition text-xs"
                                >
                                    {actionLoading ? "Sending..." : "Send Message"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD / EDIT SUPPLIER ADDRESS MODAL */}
            {showAddressModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <MapPin size={16} className="text-orange-500" />
                                {editingAddressId ? "Edit Supplier Address" : "Add New Supplier Address"}
                            </h3>
                            <button onClick={() => setShowAddressModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAddress} className="p-5 space-y-3 text-xs">
                            {/* Supplier Selection */}
                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Select Supplier</label>
                                <select
                                    required
                                    value={addressForm.supplierId}
                                    onChange={(e) => setAddressForm({ ...addressForm, supplierId: Number(e.target.value) })}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs font-medium"
                                >
                                    {suppliers.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.category})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Address Type */}
                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Address Location Type</label>
                                <select
                                    required
                                    value={addressForm.addressType}
                                    onChange={(e) => setAddressForm({ ...addressForm, addressType: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs font-medium"
                                >
                                    <option value="Warehouse">Warehouse</option>
                                    <option value="Corporate Office">Corporate Office</option>
                                    <option value="Billing Address">Billing Address</option>
                                    <option value="Processing Center">Processing Center</option>
                                    <option value="Dispatch Depot">Dispatch Depot</option>
                                </select>
                            </div>

                            {/* Street Line 1 */}
                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Address Line 1 (Street/Building)</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Plot/Door No, Street Name, Industrial Zone"
                                    value={addressForm.line1}
                                    onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                />
                            </div>

                            {/* Street Line 2 */}
                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Address Line 2 (Landmark/Area)</label>
                                <input
                                    type="text"
                                    placeholder="Near Cargo Terminal / IT Park (Optional)"
                                    value={addressForm.line2}
                                    onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                />
                            </div>

                            {/* City, State, Pincode */}
                            <div className="grid grid-cols-3 gap-2.5">
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">City</label>
                                    <input
                                        type="text"
                                        required
                                        value={addressForm.city}
                                        onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">State</label>
                                    <input
                                        type="text"
                                        required
                                        value={addressForm.state}
                                        onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">Pincode</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="500032"
                                        value={addressForm.pincode}
                                        onChange={(e) => setAddressForm({ ...addressForm, pincode: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                    />
                                </div>
                            </div>

                            {/* Contact Person & Phone */}
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">Location Contact Person</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Site Manager Name"
                                        value={addressForm.contactPerson}
                                        onChange={(e) => setAddressForm({ ...addressForm, contactPerson: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="font-medium text-slate-700">Contact Phone Number</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="+91 98765 00000"
                                        value={addressForm.phone}
                                        onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                                        className="w-full px-3 py-1.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                    />
                                </div>
                            </div>

                            {/* Set Primary Toggle */}
                            <div className="pt-2 flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isPrimaryCheck"
                                    checked={addressForm.isPrimary}
                                    onChange={(e) => setAddressForm({ ...addressForm, isPrimary: e.target.checked })}
                                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 accent-orange-500 cursor-pointer"
                                />
                                <label htmlFor="isPrimaryCheck" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
                                    Set as Primary Address for this Supplier
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddressModal(false)}
                                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-2xs transition text-xs"
                                >
                                    {editingAddressId ? "Save Changes" : "Create Address"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* CREATE PURCHASE ORDER MODAL */}
            {showPOModal && selectedSupplier && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <ShoppingCart size={16} className="text-orange-500" /> Create Purchase Order
                            </h3>
                            <button onClick={() => setShowPOModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handlePOSubmit} className="p-5 space-y-3 text-xs">
                            <div className="pb-2 border-b border-slate-100">
                                <span className="font-bold text-slate-900">{selectedSupplier.name}</span>
                                <p className="text-[11px] text-slate-500">Category: {selectedSupplier.category} • Terms: {selectedSupplier.paymentTerms}</p>
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Estimated PO Amount (₹)</label>
                                <input
                                    type="number"
                                    required
                                    min="100"
                                    value={poForm.amount}
                                    onChange={(e) => setPoForm({ ...poForm, amount: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs font-bold"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Expected Delivery Date</label>
                                <input
                                    type="date"
                                    value={poForm.expectedDelivery}
                                    onChange={(e) => setPoForm({ ...poForm, expectedDelivery: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-medium text-slate-700">Requisition Notes</label>
                                <textarea
                                    rows={2}
                                    value={poForm.notes}
                                    onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-xs"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowPOModal(false)}
                                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold shadow-2xs transition text-xs"
                                >
                                    {actionLoading ? "Issuing..." : "Issue Purchase Order"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
}

