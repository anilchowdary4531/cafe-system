-- CreateTable
CREATE TABLE "restaurants" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "slug" TEXT NOT NULL,
    "owner_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "upi_id" TEXT,
    "bank_account_number" TEXT,
    "bank_ifsc_code" TEXT,
    "bank_account_name" TEXT,
    "bank_name" TEXT,
    "address_line1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "postal_code" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gst_number" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "brand_color" TEXT,
    "favicon_url" TEXT,
    "timezone" TEXT DEFAULT 'Asia/Kolkata',
    "currency" TEXT DEFAULT 'INR',
    "tax_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tax_type" TEXT NOT NULL DEFAULT 'EXCLUSIVE',
    "default_tax_percent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "service_charge_enabled" BOOLEAN NOT NULL DEFAULT false,
    "service_charge_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoice_prefix" TEXT DEFAULT 'INV',
    "next_invoice_number" INTEGER NOT NULL DEFAULT 1001,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "designation" TEXT,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "restaurant_id" INTEGER,
    "branch_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_accesses" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "permissions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "image_url" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "original_price" DOUBLE PRECISION,
    "discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_percent" DOUBLE PRECISION,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "restaurant_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "customer_id" INTEGER,
    "order_no" TEXT NOT NULL,
    "invoice_no" TEXT,
    "invoice_s3_key" TEXT,
    "invoice_s3_url" TEXT,
    "order_source" TEXT DEFAULT 'QR',
    "fulfillment" TEXT,
    "created_by_role" TEXT,
    "created_by_user_id" INTEGER,
    "customer_type" TEXT DEFAULT 'REGISTERED',
    "customer_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "table_no" TEXT,
    "notes" TEXT,
    "delivery_address" TEXT,
    "delivery_latitude" DOUBLE PRECISION,
    "delivery_longitude" DOUBLE PRECISION,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "service_charge_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "payment_mode" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER,
    "item_name" TEXT NOT NULL,
    "prepared_by_name" TEXT,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_accounts" (
    "id" SERIAL NOT NULL,
    "phone" TEXT,
    "username" TEXT,
    "password_hash" TEXT,
    "google_id" TEXT,
    "name" TEXT,
    "email" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" SERIAL NOT NULL,
    "customer_account_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Home',
    "name" TEXT,
    "phone" TEXT,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_otps" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_otps" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_events" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM',
    "changed_by_user_id" INTEGER,
    "changed_by_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dining_tables" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "table_no" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 4,
    "qr_code_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dining_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "spent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "cashfree_order_id" TEXT,
    "payment_session_id" TEXT,
    "customer_id" INTEGER,
    "restaurant_id" INTEGER,
    "order_id" INTEGER,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_subunit" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transaction_id" TEXT,
    "payment_method" TEXT,
    "method" TEXT,
    "provider" TEXT DEFAULT 'CASHFREE',
    "provider_order_id" TEXT,
    "provider_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stocks" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "threshold_alert" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_later_accounts" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "total_borrowed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_later_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_later_transactions" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "payment_reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pay_later_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notifications" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "order_id" INTEGER,
    "restaurant_id" INTEGER,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "idempotency_key" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "customer_id" INTEGER,
    "device_token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'ANDROID',
    "device_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "customer_id" INTEGER,
    "order_updates" BOOLEAN NOT NULL DEFAULT true,
    "payment_updates" BOOLEAN NOT NULL DEFAULT true,
    "delivery_updates" BOOLEAN NOT NULL DEFAULT true,
    "promotions" BOOLEAN NOT NULL DEFAULT true,
    "coupons" BOOLEAN NOT NULL DEFAULT true,
    "review_reminders" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "image_url" TEXT NOT NULL,
    "action_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "customer_account_id" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledgers" (
    "id" SERIAL NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "customer_account_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance_before" DOUBLE PRECISION NOT NULL,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "payment_id" INTEGER,
    "order_id" INTEGER,
    "description" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_topups" (
    "id" SERIAL NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "customer_account_id" INTEGER NOT NULL,
    "topup_txn_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gateway" TEXT NOT NULL DEFAULT 'CASHFREE',
    "gateway_order_id" TEXT,
    "gateway_payment_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_profiles" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "business_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "gstin" TEXT,
    "fssai_license" TEXT,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "description" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.8,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "bank_account_number" TEXT,
    "bank_ifsc_code" TEXT,
    "bank_account_name" TEXT,
    "bank_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_addresses" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Warehouse',
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_products" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "category_id" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "moq" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_product_images" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_prices" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "base_price" DOUBLE PRECISION NOT NULL,
    "tax_percent" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_discounts" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "value" DOUBLE PRECISION NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_inventories" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "total_stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reserved_stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "available_stock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "low_stock_alert" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_inventories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_inventory_transactions" (
    "id" SERIAL NOT NULL,
    "inventory_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "balance_before" DOUBLE PRECISION NOT NULL,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_inventory_batches" (
    "id" SERIAL NOT NULL,
    "inventory_id" INTEGER NOT NULL,
    "batch_number" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "cost_price" DOUBLE PRECISION,
    "manufacture_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_carts" (
    "id" SERIAL NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_cart_items" (
    "id" SERIAL NOT NULL,
    "cart_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "final_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_orders" (
    "id" SERIAL NOT NULL,
    "order_no" TEXT NOT NULL,
    "restaurant_id" INTEGER NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "delivery_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_mode" TEXT,
    "notes" TEXT,
    "delivery_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_order_status_events" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "created_role" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_order_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "gateway_txn_id" TEXT,
    "payment_session_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'CASHFREE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_refunds" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "refund_txn_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_settlements" (
    "id" SERIAL NOT NULL,
    "settlement_no" TEXT NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "gross_amount" DOUBLE PRECISION NOT NULL,
    "commission_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_payable" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payout_ref" TEXT,
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_settlement_items" (
    "id" SERIAL NOT NULL,
    "settlement_id" INTEGER NOT NULL,
    "order_id" INTEGER NOT NULL,
    "order_amount" DOUBLE PRECISION NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL,
    "net_amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_reviews" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "restaurant_id" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_analytics_events" (
    "id" SERIAL NOT NULL,
    "event_type" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" INTEGER,
    "target_id" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_slug_key" ON "restaurants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_restaurant_id_role_is_active_idx" ON "users"("restaurant_id", "role", "is_active");

-- CreateIndex
CREATE INDEX "users_restaurant_id_branch_id_idx" ON "users"("restaurant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_accesses_user_id_key" ON "staff_accesses"("user_id");

-- CreateIndex
CREATE INDEX "staff_accesses_restaurant_id_idx" ON "staff_accesses"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_accesses_restaurant_id_user_id_key" ON "staff_accesses"("restaurant_id", "user_id");

-- CreateIndex
CREATE INDEX "menu_items_restaurant_id_category_is_available_idx" ON "menu_items"("restaurant_id", "category", "is_available");

-- CreateIndex
CREATE INDEX "orders_restaurant_id_customer_id_created_at_idx" ON "orders"("restaurant_id", "customer_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_restaurant_id_status_created_at_idx" ON "orders"("restaurant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "orders_restaurant_id_branch_id_created_at_idx" ON "orders"("restaurant_id", "branch_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_phone_created_at_idx" ON "orders"("phone", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_restaurant_id_order_no_key" ON "orders"("restaurant_id", "order_no");

-- CreateIndex
CREATE INDEX "customers_restaurant_id_email_idx" ON "customers"("restaurant_id", "email");

-- CreateIndex
CREATE INDEX "customers_restaurant_id_created_at_idx" ON "customers"("restaurant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_restaurant_id_phone_key" ON "customers"("restaurant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_phone_key" ON "customer_accounts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_username_key" ON "customer_accounts"("username");

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_google_id_key" ON "customer_accounts"("google_id");

-- CreateIndex
CREATE INDEX "customer_accounts_phone_created_at_idx" ON "customer_accounts"("phone", "created_at");

-- CreateIndex
CREATE INDEX "customer_accounts_username_idx" ON "customer_accounts"("username");

-- CreateIndex
CREATE INDEX "customer_accounts_email_idx" ON "customer_accounts"("email");

-- CreateIndex
CREATE INDEX "customer_accounts_google_id_idx" ON "customer_accounts"("google_id");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_account_id_idx" ON "customer_addresses"("customer_account_id");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_account_id_is_default_idx" ON "customer_addresses"("customer_account_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "customer_otps_phone_key" ON "customer_otps"("phone");

-- CreateIndex
CREATE INDEX "customer_otps_phone_expires_at_idx" ON "customer_otps"("phone", "expires_at");

-- CreateIndex
CREATE INDEX "auth_otps_phone_actor_type_expires_at_idx" ON "auth_otps"("phone", "actor_type", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_otps_phone_actor_type_key" ON "auth_otps"("phone", "actor_type");

-- CreateIndex
CREATE INDEX "order_status_events_order_id_created_at_idx" ON "order_status_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_status_events_status_created_at_idx" ON "order_status_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "dining_tables_restaurant_id_is_active_idx" ON "dining_tables"("restaurant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "dining_tables_restaurant_id_table_no_key" ON "dining_tables"("restaurant_id", "table_no");

-- CreateIndex
CREATE INDEX "expenses_restaurant_id_spent_at_idx" ON "expenses"("restaurant_id", "spent_at");

-- CreateIndex
CREATE INDEX "expenses_restaurant_id_created_at_idx" ON "expenses"("restaurant_id", "created_at");

-- CreateIndex
CREATE INDEX "branches_restaurant_id_is_active_idx" ON "branches"("restaurant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "branches_restaurant_id_name_key" ON "branches"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "payments_restaurant_id_created_at_idx" ON "payments"("restaurant_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_cashfree_order_id_idx" ON "payments"("cashfree_order_id");

-- CreateIndex
CREATE INDEX "payments_payment_session_id_idx" ON "payments"("payment_session_id");

-- CreateIndex
CREATE INDEX "inventory_stocks_restaurant_id_idx" ON "inventory_stocks"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stocks_restaurant_id_menu_item_id_key" ON "inventory_stocks"("restaurant_id", "menu_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_later_accounts_restaurant_id_customer_id_key" ON "pay_later_accounts"("restaurant_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_idempotency_key_key" ON "notifications"("idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_recipient_type_recipient_id_is_read_idx" ON "notifications"("recipient_type", "recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_order_id_idx" ON "notifications"("order_id");

-- CreateIndex
CREATE INDEX "notifications_restaurant_id_idx" ON "notifications"("restaurant_id");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_is_active_idx" ON "device_tokens"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "device_tokens_customer_id_is_active_idx" ON "device_tokens"("customer_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_device_token_key" ON "device_tokens"("device_token");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_customer_id_key" ON "notification_preferences"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_categories_name_key" ON "global_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_customer_account_id_key" ON "wallets"("customer_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledgers_idempotency_key_key" ON "wallet_ledgers"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_ledgers_wallet_id_created_at_idx" ON "wallet_ledgers"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_ledgers_customer_account_id_created_at_idx" ON "wallet_ledgers"("customer_account_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_ledgers_order_id_idx" ON "wallet_ledgers"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_topups_topup_txn_id_key" ON "wallet_topups"("topup_txn_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_topups_idempotency_key_key" ON "wallet_topups"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_topups_wallet_id_created_at_idx" ON "wallet_topups"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_topups_customer_account_id_idx" ON "wallet_topups"("customer_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_email_key" ON "suppliers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_phone_key" ON "suppliers"("phone");

-- CreateIndex
CREATE INDEX "suppliers_status_created_at_idx" ON "suppliers"("status", "created_at");

-- CreateIndex
CREATE INDEX "suppliers_phone_idx" ON "suppliers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_profiles_supplier_id_key" ON "supplier_profiles"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_profiles_gstin_key" ON "supplier_profiles"("gstin");

-- CreateIndex
CREATE INDEX "supplier_addresses_supplier_id_is_primary_idx" ON "supplier_addresses"("supplier_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "supply_categories_name_key" ON "supply_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "supply_categories_slug_key" ON "supply_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "supply_products_slug_key" ON "supply_products"("slug");

-- CreateIndex
CREATE INDEX "supply_products_supplier_id_status_is_deleted_idx" ON "supply_products"("supplier_id", "status", "is_deleted");

-- CreateIndex
CREATE INDEX "supply_products_category_id_is_available_status_idx" ON "supply_products"("category_id", "is_available", "status");

-- CreateIndex
CREATE INDEX "supply_product_images_product_id_is_primary_idx" ON "supply_product_images"("product_id", "is_primary");

-- CreateIndex
CREATE INDEX "supply_prices_product_id_is_active_idx" ON "supply_prices"("product_id", "is_active");

-- CreateIndex
CREATE INDEX "supply_discounts_product_id_is_active_idx" ON "supply_discounts"("product_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "supply_inventories_product_id_key" ON "supply_inventories"("product_id");

-- CreateIndex
CREATE INDEX "supply_inventory_transactions_inventory_id_created_at_idx" ON "supply_inventory_transactions"("inventory_id", "created_at");

-- CreateIndex
CREATE INDEX "supply_inventory_batches_inventory_id_batch_number_idx" ON "supply_inventory_batches"("inventory_id", "batch_number");

-- CreateIndex
CREATE UNIQUE INDEX "supply_carts_restaurant_id_key" ON "supply_carts"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "supply_cart_items_cart_id_product_id_key" ON "supply_cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "supply_orders_order_no_key" ON "supply_orders"("order_no");

-- CreateIndex
CREATE INDEX "supply_orders_restaurant_id_created_at_idx" ON "supply_orders"("restaurant_id", "created_at");

-- CreateIndex
CREATE INDEX "supply_orders_supplier_id_status_created_at_idx" ON "supply_orders"("supplier_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "supply_order_status_events_order_id_created_at_idx" ON "supply_order_status_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "supply_payments_order_id_idx" ON "supply_payments"("order_id");

-- CreateIndex
CREATE INDEX "supply_payments_gateway_txn_id_idx" ON "supply_payments"("gateway_txn_id");

-- CreateIndex
CREATE UNIQUE INDEX "supply_refunds_refund_txn_id_key" ON "supply_refunds"("refund_txn_id");

-- CreateIndex
CREATE INDEX "supply_refunds_order_id_idx" ON "supply_refunds"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_settlements_settlement_no_key" ON "supplier_settlements"("settlement_no");

-- CreateIndex
CREATE INDEX "supplier_settlements_supplier_id_status_created_at_idx" ON "supplier_settlements"("supplier_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_settlement_items_order_id_key" ON "supplier_settlement_items"("order_id");

-- CreateIndex
CREATE INDEX "supply_reviews_supplier_id_rating_idx" ON "supply_reviews"("supplier_id", "rating");

-- CreateIndex
CREATE INDEX "supply_reviews_product_id_rating_idx" ON "supply_reviews"("product_id", "rating");

-- CreateIndex
CREATE INDEX "supply_analytics_events_event_type_created_at_idx" ON "supply_analytics_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "supply_analytics_events_actor_type_actor_id_idx" ON "supply_analytics_events"("actor_type", "actor_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_accesses" ADD CONSTRAINT "staff_accesses_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_accesses" ADD CONSTRAINT "staff_accesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_later_accounts" ADD CONSTRAINT "pay_later_accounts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_later_accounts" ADD CONSTRAINT "pay_later_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_later_transactions" ADD CONSTRAINT "pay_later_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "pay_later_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_later_transactions" ADD CONSTRAINT "pay_later_transactions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_later_transactions" ADD CONSTRAINT "pay_later_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_later_transactions" ADD CONSTRAINT "pay_later_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_customer_account_id_fkey" FOREIGN KEY ("customer_account_id") REFERENCES "customer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "wallet_ledgers_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_addresses" ADD CONSTRAINT "supplier_addresses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_products" ADD CONSTRAINT "supply_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_products" ADD CONSTRAINT "supply_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "supply_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_product_images" ADD CONSTRAINT "supply_product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "supply_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_prices" ADD CONSTRAINT "supply_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "supply_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_discounts" ADD CONSTRAINT "supply_discounts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "supply_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_inventories" ADD CONSTRAINT "supply_inventories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "supply_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_inventory_transactions" ADD CONSTRAINT "supply_inventory_transactions_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "supply_inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_inventory_batches" ADD CONSTRAINT "supply_inventory_batches_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "supply_inventories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_carts" ADD CONSTRAINT "supply_carts_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_cart_items" ADD CONSTRAINT "supply_cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "supply_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_cart_items" ADD CONSTRAINT "supply_cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "supply_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_orders" ADD CONSTRAINT "supply_orders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_orders" ADD CONSTRAINT "supply_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_order_items" ADD CONSTRAINT "supply_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supply_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_order_items" ADD CONSTRAINT "supply_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "supply_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_order_status_events" ADD CONSTRAINT "supply_order_status_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supply_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_payments" ADD CONSTRAINT "supply_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supply_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_refunds" ADD CONSTRAINT "supply_refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supply_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_settlements" ADD CONSTRAINT "supplier_settlements_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_settlement_items" ADD CONSTRAINT "supplier_settlement_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "supplier_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_settlement_items" ADD CONSTRAINT "supplier_settlement_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "supply_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_reviews" ADD CONSTRAINT "supply_reviews_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_reviews" ADD CONSTRAINT "supply_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "supply_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

