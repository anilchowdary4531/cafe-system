import { getCashfreeInstance, CASHFREE_API_VERSION } from "../config/cashfree.config.js";

/**
 * Service for Cashfree Easy Split Vendor Integration
 */
export const createCashfreeVendor = async ({
  restaurantId,
  vendorId,
  name,
  email,
  phone,
  bankAccount,
  ifsc,
  upi,
  maxRetries = 3,
}) => {
  const cashfree = getCashfreeInstance();

  const formattedRestaurantId = String(restaurantId || "").trim();
  const formattedVendorId = String(vendorId || `vendor_rest_${formattedRestaurantId}_${Date.now()}`).trim();
  const formattedName = String(name || `Restaurant_${formattedRestaurantId}`).trim();
  const formattedEmail = email && email.includes("@") ? String(email).trim().toLowerCase() : "vendor@tiffzy.com";

  let formattedPhone = String(phone || "").replace(/[^\d]/g, "");
  if (!formattedPhone || formattedPhone.length < 10) {
    formattedPhone = "9999999999";
  } else if (formattedPhone.length > 10 && formattedPhone.startsWith("91")) {
    formattedPhone = formattedPhone.slice(2);
  }
  if (formattedPhone.length > 10) {
    formattedPhone = formattedPhone.slice(-10);
  }

  const vendorPayload = {
    vendor_id: formattedVendorId,
    name: formattedName,
    email: formattedEmail,
    phone: formattedPhone,
    verify_account: false,
    dashboard_access: false,
    schedule_option: 1,
  };

  if (bankAccount && ifsc) {
    vendorPayload.bank_details = {
      account_number: String(bankAccount).trim(),
      account_holder: formattedName,
      ifsc: String(ifsc).trim().toUpperCase(),
    };
  }

  if (upi) {
    vendorPayload.upi = {
      vpa: String(upi).trim(),
    };
  }

  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    const timestamp = new Date().toISOString();

    console.log(`[VendorService] Requesting Cashfree Easy Split Vendor Creation (Attempt ${attempt}/${maxRetries}):`, {
      timestamp,
      restaurantId: formattedRestaurantId,
      vendorId: formattedVendorId,
      name: formattedName,
    });

    try {
      const response = await cashfree.PGESCreateVendors(CASHFREE_API_VERSION, vendorPayload);
      const data = response?.data || response;

      console.log(`[VendorService] Cashfree Easy Split Vendor Created Successfully (Attempt ${attempt}):`, {
        timestamp: new Date().toISOString(),
        vendorId: data?.vendor_id || formattedVendorId,
        status: data?.status || "ACTIVE",
      });

      return {
        success: true,
        vendorId: data?.vendor_id || formattedVendorId,
        name: formattedName,
        restaurantId: formattedRestaurantId,
        status: data?.status || "ACTIVE",
        data,
      };
    } catch (err) {
      lastError = err?.response?.data?.message || err?.message || "Cashfree Easy Split vendor creation failed";
      console.warn(`[VendorService] Attempt ${attempt}/${maxRetries} failed:`, lastError);

      if (attempt < maxRetries) {
        // Exponential delay before retry (1s, 2s, 4s)
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.error(`[VendorService] All ${maxRetries} retries failed for Cashfree Vendor creation:`, lastError);
  throw new Error(`Failed to create Cashfree vendor after ${maxRetries} retries: ${lastError}`);
};
