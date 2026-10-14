const resolveApiBaseUrl = () => {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  return "https://estorebackend.amptechnology.in/api";
};

const API_BASE_URL = resolveApiBaseUrl();

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const storeProductsUrl = (storeId: string) =>
  `${API_BASE_URL}/product/store/${encodeURIComponent(storeId)}`;

export type ApiDelivery = {
  deliverable: boolean;
  mode?: string;
  distanceKm?: number | null;
  minMinutes?: number | null;
  maxMinutes?: number | null;
  minDays?: number | null;
  maxDays?: number | null;
  estimatedMinDate?: string | null;
  estimatedMaxDate?: string | null;
  shippingCharge?: number | null;
  shippingNote?: string | null;
  freeDeliveryAbove?: number | null;
  label?: string | null;
};

export type ApiGst = {
cgst?: number | null;
sgst?: number | null;
igst?: number | null;
};

export type ApiAddress = {
  addressLine?: string;
  area?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
};

export type ApiUser = {
  _id?: string;
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  image?: string;
  role?: string;
  phone?: string;
  isActive?: boolean;
  address?: ApiAddress;
};

export type ApiSizeVariant = {
  _id?: string;
  id?: string;
  size?: string;
  weight?: string;
  height?: string;
  mrp?: number;
  offerPrice?: number;
  openingStock?: number;
  currentStock?: number;
  stock?: number;
  sku?: string | null;
  effectiveGst?: ApiGst;
  isActive?: boolean;
};

export type ApiVariant = {
  _id?: string;
  id?: string;
  color?: string;
  size?: string;
  weight?: string;
  mrp?: number;
  offerPrice?: number;
  stock?: number;
  sku?: string;
  isActive?: boolean;
  images?: string[];
  sizeVariants?: ApiSizeVariant[];
effectiveGst?: ApiGst; // NEW — nested variants (e.g. Sofa-style color→size structure)
};

type ApiProductSource = Partial<{
  _id: string;
  id: string;
  variantId: string;
  variant_id: string;
  variants: ApiVariant[];
  minOfferPrice: number;
  title: string;
  name: string;
  description: string;
  price: number | string;
  mrp: number | string;
  offerPrice: number | string;
  sellingPrice: number | string;
  salePrice: number | string;
  image: string;
  images: string[];
  brandId: string;
  categoryId: string | null;
  category: string | null | { _id?: string; name?: string };
  subcategoryId: string;
  storeId: string;
  unit: string;
  size: string;
  weight: string | number;
  deliveryTime: string;
  productCode: string;
  createdAt: string;
  delivery: ApiDelivery | null;
gst: ApiGst | null;
gstInclusive: boolean;
  priceOnRequest: boolean;
  hasTierPricing: boolean;
  minTierPrice: number | null;
  priceTiers: { minQty: number; maxQty: number | null; price: number }[];
}>;

export type ApiProduct = {
  _id: string;
  title: string;
  description?: string;
  price: number;
  originalPrice?: number;
  minOfferPrice?: number;
  image?: string;
  images?: string[];
  brandId?: string;
  categoryId?: string;
  categoryName?: string;
  subcategoryId?: string;
  unit?: string;
  size?: string;
  weight?: string | number;
  deliveryTime?: string;
  productCode?: string;
  storeId?: string;
  variantId?: string;
  color?: string;
  colorVariantId?: string;
  variants?: ApiVariant[];
  rating?: number;
  delivery?: ApiDelivery;
  priceOnRequest?: boolean;
gst?: ApiGst;
gstInclusive?: boolean;
  hasTierPricing?: boolean;
  minTierPrice?: number | null;
  priceTiers?: { minQty: number; maxQty: number | null; price: number }[];
};

const normalizeProduct = (
  product?: ApiProductSource | null,
): ApiProduct | undefined => {
  if (!product) return undefined;

  const id = product._id ?? product.id ?? "";
  const title = product.title ?? product.name ?? "Product";
  const image = product.image ?? product.images?.[0];
  const firstVariant =
    Array.isArray(product.variants) && product.variants.length > 0
      ? product.variants[0]
      : undefined;

  const firstSizeVariant = firstVariant?.sizeVariants?.[0];
  const offerPrice = Number(
    product.minOfferPrice ??
      firstSizeVariant?.offerPrice ??
      firstVariant?.offerPrice ??
      product.offerPrice ??
      product.sellingPrice ??
      product.salePrice ??
      product.price ??
      0,
  );
  const originalPrice = Number(
    firstSizeVariant?.mrp ??
      firstVariant?.mrp ??
      product.mrp ??
      product.price ??
      offerPrice ??
      0,
  );
  const categoryName =
    typeof product.category === "object" && product.category
      ? (product.category.name ?? "Collection")
      : (product.categoryId ?? "Collection");
  const variantId =
    product.variantId ?? product.variant_id ?? firstVariant?._id;

  return {
    _id: id,
    title,
    description: product.description ?? "",
    price: Number.isFinite(offerPrice) ? offerPrice : 0,
    originalPrice: Number.isFinite(originalPrice) ? originalPrice : undefined,
    minOfferPrice: product.minOfferPrice,
    image,
    images: product.images ?? (image ? [image] : []),
    brandId: product.brandId ?? product.storeId,
    categoryId:
      typeof product.category === "string"
        ? product.category
        : (product.categoryId ?? "Collection"),
    categoryName,
    subcategoryId: product.subcategoryId,
    unit: product.unit,
    size: firstVariant?.size || product.size,
    weight: firstVariant?.weight || product.weight,
    deliveryTime: product.deliveryTime,
    productCode: product.productCode,
    storeId: product.storeId,
    variantId,
    variants: product.variants,
    delivery: product.delivery ?? undefined,
    priceOnRequest: product.priceOnRequest,
    hasTierPricing: product.hasTierPricing,
    minTierPrice: product.minTierPrice,
    priceTiers: product.priceTiers,
gst: product.gst ?? undefined,
gstInclusive: product.gstInclusive,
  };
};

export type ApiCartItem = {
  _id?: string;
  productId?: string | { _id?: string; id?: string };
  variantId?: string;
  color?: string;
  colorVariantId?: string;
  product?: ApiProduct;
  quantity: number;
  storeId?: string;
  storeName?: string;
  isAvailable?: boolean;
  name?: string;
  productCode?: string;
  image?: string | null;
  unit?: string;
  size?: string | null;
  weight?: string | null;
  mrp?: number | string;
  offerPrice?: number | string;
};

export type ApiCartResponse = {
  cart?:
    | ApiCartItem[]
    | {
        _id?: string;
        items?: ApiCartItem[];
        stores?: {
          store?: { _id?: string; storeName?: string };
          items?: ApiCartItem[];
        }[];
      };
  data?:
    | ApiCartItem[]
    | {
        _id?: string;
        items?: ApiCartItem[];
        stores?: {
          store?: { _id?: string; storeName?: string };
          items?: ApiCartItem[];
        }[];
      };
  cartItems?: ApiCartItem[];
  cartId?: string;
  _id?: string;
};



type ProductListResponse = {
  success?: boolean;
  store?: { _id?: string; storeUniqueId?: string };
  delivery?: ApiDelivery;
  products: ApiProductSource[];
  pagination?: { totalData?: number };
  totalProducts?: number;
};

const mapProductList = (response: ProductListResponse) => ({
  ...response,
  products: (response.products ?? [])
    .map((p) => normalizeProduct(p))
    .filter((p): p is ApiProduct => Boolean(p)),
  pagination: {
    ...(response.pagination ?? {}),
    totalData: response.pagination?.totalData ?? response.totalProducts ?? 0,
  },
});

const withQuery = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const apiImageUrl = (image?: string) => {
  if (!image) return undefined;
  if (image.startsWith("http")) return image;
  return `${API_BASE_URL}/${image.replaceAll("\\", "/")}`;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  baseUrl = API_BASE_URL,
) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedRelativePath =
    normalizedBase.endsWith("/api") && normalizedPath.startsWith("/api")
      ? normalizedPath.replace(/^\/api/, "")
      : normalizedPath;

  const finalUrl = `${normalizedBase}${normalizedRelativePath}`;
  const response = await fetch(finalUrl, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (finalUrl.includes("/cart") || finalUrl.includes("/checkout")) {
    console.log("[API] Request completed", {
      method: options.method ?? "GET",
      url: finalUrl,
      status: response.status,
      authenticated: Boolean(
        options.headers && "x-access-token" in options.headers,
      ),
    });
  }
  if (!response.ok) {
    (response.status === 404 ? console.warn : console.error)("[API] Request failed", {
      method: options.method ?? "GET",
      url: finalUrl,
      status: response.status,
      payload: JSON.stringify(payload),
    });
    throw new ApiRequestError(
      payload.message || "Something went wrong.",
      response.status,
    );
  }
  return payload as T;
}

export const api = {
  signIn: (email: string, password: string) =>
    request<{
      success: boolean;
      user?: ApiUser;
      data?: ApiUser;
      token: string;
      message: string;
    }>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role: "USER" }),
    }),
  signUp: (fields: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone?: string;
  }) =>
    request<{ success: boolean; user: ApiUser; message: string }>(
      "/register/register-user",
      {
        method: "POST",
        body: JSON.stringify({
          ...fields,
          name: fields.name?.trim() || "",
          phone: fields.phone?.trim() || undefined,
        }),
      },
    ),
  verifyOtp: (email: string, otp: string) =>
    request<{ status: boolean; message: string }>(
      "/register/verify-email-otp",
      {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      },
    ),
  verifyEmailForReset: (email: string) =>
    request<{
      status: boolean;
      message: string;
      token?: string;
      user?: ApiUser;
    }>("/login/reset-password-link", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (
    userId: string,
    resetToken: string,
    password: string,
    confirmPassword: string,
  ) =>
    request<{ status: string; message: string }>(
      `/login/forget-password/${userId}/${resetToken}`,
      { method: "POST", body: JSON.stringify({ password, confirmPassword }) },
    ),
  dashboard: (token: string) =>
    request<{ message: string; user?: ApiUser; data?: ApiUser }>(
      "/login/profile-page",
      {
        headers: { "x-access-token": token },
      },
    ),
  updateProfile: async (
    token: string,
    fields: { name?: string; phone?: string; address?: ApiAddress },
  ) => {
    try {
      return await request<{ message: string; user?: ApiUser }>(
        "/login/update-profile",
        {
          method: "PUT",
          headers: { "x-access-token": token },
          body: JSON.stringify(fields),
        },
      );
    } catch (err: any) {
      if (err?.status === 404) {
        try {
          return await request<{ message: string; user?: ApiUser }>(
            "/login/update-profile",
            {
              method: "POST",
              headers: { "x-access-token": token },
              body: JSON.stringify(fields),
            },
          );
        } catch {
          console.warn(
            "[API] /login/update-profile endpoint not available on backend; fallback to local storage.",
          );
          return { message: "Updated locally", user: undefined };
        }
      }
      throw err;
    }
  },
  changePassword: (
    token: string,
    fields: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    },
  ) =>
    request<{ message?: string }>("/login/update-profile", {
      method: "PUT",
      headers: { "x-access-token": token },
      body: JSON.stringify({
        currentPassword: fields.currentPassword,
        password: fields.newPassword,
        confirmPassword: fields.confirmPassword,
      }),
    }),
  storeExists: async (storeId: string) => {
    const trimmed = storeId?.trim();
    if (!trimmed) return false;

    try {
      await request<{ success?: boolean; store?: unknown }>(
        "?limit=1",
        { method: "GET" },
        `${storeProductsUrl(trimmed)}/products`,
      );
      return true;
    } catch {
      return false;
    }
  },
  storeInfo: async (storeId: string) => {
    const trimmed = storeId?.trim();
    if (!trimmed) return null;
    try {
      const res = await request<{
        store?: {
          _id?: string;
          storeName?: string;
          name?: string;
          whatsapp?: string;
          whatsappNo?: string;
          contactNo?: string;
          phone?: string;
        };
      }>(
        "?limit=1",
        { method: "GET" },
        `${storeProductsUrl(trimmed)}/products`,
      );
      return {
        id: trimmed,
        mongoId: res.store?._id,
        name: res.store?.storeName ?? res.store?.name,
        phone:
          res.store?.whatsappNo ??
          res.store?.whatsapp ??
          res.store?.contactNo ??
          res.store?.phone,
      };
    } catch {
      return null;
    }
  },
  products: async (storeId: string, page = 1, pincode?: string) => {
    const response = await request<{
      store?: { _id?: string; storeUniqueId?: string };
      delivery?: ApiDelivery;
      products: ApiProductSource[];
      pagination?: { totalData?: number };
      totalProducts?: number;
    }>(
      withQuery({ page: page > 1 ? String(page) : undefined, pincode }),
      {},
      `${storeProductsUrl(storeId)}/products`,
    );

    return {
      ...response,
      products: (response.products ?? [])
        .map((product) => normalizeProduct(product))
        .filter((product): product is ApiProduct => Boolean(product)),
      pagination: {
        ...(response.pagination ?? {}),
        totalData:
          response.pagination?.totalData ?? response.totalProducts ?? 0,
      },
    };
  },
  allProducts: async (storeId: string, pincode?: string) => {
    const firstPage = await api.products(storeId, 1, pincode);
    const pageSize = Math.max(firstPage.products.length, 1);
    const totalPages = Math.ceil(
      (firstPage.pagination?.totalData ?? pageSize) / pageSize,
    );
    const remaining = await Promise.all(
      Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) =>
        api.products(storeId, index + 2, pincode),
      ),
    );
    return [firstPage, ...remaining].flatMap((response) => response.products);
  },
  product: async (storeId: string, id: string, pincode?: string) => {
    const response = await request<{
      store?: { products?: ApiProductSource[] };
      product?: ApiProductSource;
      data?: ApiProductSource;
      products?: ApiProductSource[];
    }>(
      `/${id}${withQuery({ pincode })}`,
      {},
      `${storeProductsUrl(storeId)}/products`,
    );

    const products = response.products ?? response.store?.products ?? [];
    const selectedProduct =
      normalizeProduct(response.product ?? response.data) ??
      products.map(normalizeProduct).find((entry) => entry?._id === id);

    return {
      ...response,
      product: selectedProduct,
      data: selectedProduct,
      products,
    };
  },
  productsByCategory: async (
    storeId: string,
    categoryId: string,
    page = 1,
    pincode?: string,
  ) => {
    const response = await request<{
      category?: { _id: string; name: string };
      products: ApiProductSource[];
      pagination?: { totalData?: number };
      totalProducts?: number;
    }>(
      withQuery({ page: page > 1 ? String(page) : undefined, pincode }),
      {},
      `${storeProductsUrl(storeId)}/categories/${encodeURIComponent(
        categoryId,
      )}/products`,
    );

    return {
      ...response,
      products: (response.products ?? [])
        .map((product) => normalizeProduct(product))
        .filter((product): product is ApiProduct => Boolean(product)),
      pagination: {
        ...(response.pagination ?? {}),
        totalData:
          response.pagination?.totalData ?? response.totalProducts ?? 0,
      },
    };
  },
  searchProducts: async (
    storeId: string,
    title: string,
    page = 1,
    pincode?: string,
  ) => {
    const params = new URLSearchParams({ search: title });
    if (page > 1) params.set("page", String(page));
    if (pincode) params.set("pincode", pincode);

    const response = await request<{
      products: ApiProductSource[];
      pagination?: { totalData?: number };
      totalProducts?: number;
    }>(`?${params.toString()}`, {}, `${storeProductsUrl(storeId)}/products`);

    return {
      ...response,
      products: (response.products ?? [])
        .map((product) => normalizeProduct(product))
        .filter((product): product is ApiProduct => Boolean(product)),
      pagination: {
        ...(response.pagination ?? {}),
        totalData:
          response.pagination?.totalData ?? response.totalProducts ?? 0,
      },
    };
  },
  categories: (storeId: string) =>
    request<{
      success?: boolean;
      store?: unknown;
      count?: number;
      categories: {
        _id: string;
        name: string;
        productCount?: number;
        image?: string;
        icon?: string;
      }[];
    }>("", {}, `${storeProductsUrl(storeId)}/categories`),
  subcategoryDetails: (id: string) => request(`/api/subcategorydetails/${id}`),
  brands: () =>
    request<{
      brands: {
        _id: { brandId: string; name: string };
        totalproducts: number;
      }[];
    }>("/api/brands"),
  brandDetails: (id: string) => request(`/api/branddetails/${id}`),
  banners: () =>
    request<{
      success?: boolean;
      banners: {
        _id: string;
        name: string;
        image: string;
        isActive: boolean;
        storeId: string;
        categoryId?: string | { _id?: string } | null;
        productId?: string | { _id?: string } | null;
      }[];
    }>("/banner/banners"),
  cart: async (token: string) => {
    console.log("[Cart] Fetching backend cart", {
      endpoint: `${API_BASE_URL}/cart`,
      authenticated: Boolean(token),
    });
    const response = await request<ApiCartResponse>("/api/cart", {
      headers: { "x-access-token": token },
    });
    const cartValue = response.cart ?? response.data;
    const cartObject =
      cartValue && !Array.isArray(cartValue) ? cartValue : undefined;
    const items = Array.isArray(cartValue)
      ? cartValue
      : (cartObject?.items ??
        cartObject?.stores?.flatMap((store) => store.items ?? []) ??
        response.cartItems ??
        []);
    console.log("[Cart] Backend cart loaded", {
      cartId: response.cartId ?? response._id ?? cartObject?._id ?? null,
      itemCount: items.length,
      items: items.map((item) => ({
        cartItemId: item._id,
        productId:
          item.product?._id ??
          (typeof item.productId === "string"
            ? item.productId
            : (item.productId?._id ?? item.productId?.id)),
        quantity: item.quantity,
      })),
    });
    return response;
  },
  addCart: (
    token: string,
    productId: string,
    quantity = 1,
    options?: { variantId?: string; size?: string; weight?: string | number },
  ) => {
    const body: {
      productId: string;
      variantId?: string;
      quantity: number;
    } = {
      productId,
      quantity,
    };
    if (options?.variantId) body.variantId = options.variantId;
    console.log("[Cart] Adding product to cart", body);
    return request("/cart/add", {
      method: "POST",
      headers: { "x-access-token": token },
      body: JSON.stringify(body),
    }).then((response) => {
      console.log("[Cart] Backend add succeeded", {
        productId,
        variantId: body.variantId,
        quantity,
        response,
      });
      return response;
    });
  },
  updateCartItem: (token: string, itemId: string, quantity: number) =>
    request(`/cart/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "x-access-token": token },
      body: JSON.stringify({ quantity }),
    }).then((response) => {
      console.log("[Cart] Backend quantity update succeeded", {
        cartItemId: itemId,
        quantity,
        response,
      });
      return response;
    }),
  removeCartItem: (token: string, itemId: string) =>
    request(`/cart/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      headers: { "x-access-token": token },
    }).then((response) => {
      console.log("[Cart] Backend item removal succeeded", {
        cartItemId: itemId,
        response,
      });
      return response;
    }),
  checkout: (
    token: string,
    payload: {
      cartId: string;
      storeIds: string[];
      deliveryAddress: {
        fullName: string;
        phone: string;
        addressLine: string;
        area?: string;
        city: string;
        state: string;
        pincode: string;
        country: string;
      };
      note?: string;
      paymentMethod?: "COD" | "ONLINE";
    },
  ) => {
    const options = {
      method: "POST",
      headers: { "x-access-token": token },
      body: JSON.stringify(payload),
    } satisfies RequestInit;

    return request("/order/checkout", options);
  },
  buyNow: (
    token: string,
    payload: {
      productId: string;
      variantId?: string;
      quantity: number;
      deliveryAddress: {
        fullName: string;
        phone: string;
        addressLine: string;
        area?: string;
        city: string;
        state: string;
        pincode: string;
        country: string;
      };
      note?: string;
      paymentMethod?: string;
    },
  ) => {
    return request<{
      success: boolean;
      message: string;
      order?: unknown;
    }>("/order/buy-now", {
      method: "POST",
      headers: { "x-access-token": token },
      body: JSON.stringify(payload),
    });
  },
  deliveryCheck: (params: {
    storeUniqueId: string;
    pincode: string;
    productId?: string;
    variantId?: string;
    quantity?: number;
    itemsTotal?: number;
  }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(
      ([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)),
    );
    return request<{
      success: boolean;
      deliverable: boolean;
      message: string | null;
      delivery: ApiDelivery | null;
    }>(`/delivery/check?${q.toString()}`);
  },
  checkoutPreview: (
    token: string,
    body: {
      cartId?: string;
      storeIds?: string[];
      productId?: string;
      variantId?: string;
      quantity?: number;
      paymentMethod?: "COD" | "ONLINE";
      deliveryAddress: { pincode: string; state?: string; country?: string };
    },
  ) =>
    request<{
      success: boolean;
      itemsTotal: number;
      totalShipping: number;
      grandTotal: number;
      stores: {
        storeId: string;
        storeName: string | null;
        ok: boolean;
        message?: string;
        shippingCharge: number;
        delivery: ApiDelivery | null;
      }[];
    }>("/order/checkout-preview", {
      method: "POST",
      headers: { "x-access-token": token },
      body: JSON.stringify(body),
    }),
  registerStoreVisit: (
    token: string,
    store: { storeUniqueId?: string; storeId?: string },
  ) =>
    request<{ success: boolean; message: string }>("/store-visit", {
      method: "POST",
      headers: { "x-access-token": token },
      body: JSON.stringify(store),
    }),
  initiatePayment: (token: string, orderId: string) =>
    request<{
      success: boolean;
      message: string;
      paymentUrl: string;
      payuParams: Record<string, string>;
    }>(`/payment/initiate/${encodeURIComponent(orderId)}`, {
      method: "POST",
      headers: { "x-access-token": token },
      body: JSON.stringify({}),
    }),
  verifyPayment: (token: string, orderId: string) =>
    request<{
      success?: boolean;
      order: { _id: string; paymentStatus: string; totalAmount?: number };
    }>(`/payment/verify/${encodeURIComponent(orderId)}`, {
      headers: { "x-access-token": token },
    }),
  clearCart: (token: string) =>
    request("/cart", {
      method: "DELETE",
      headers: { "x-access-token": token },
    }),
  orders: (token: string) =>
    request<{
      orders?: unknown[];
      data?: unknown[];
      order?: unknown[];
      orderList?: unknown[];
    }>("/order/my-orders", {
      headers: { "x-access-token": token },
    }),
  cancelOrder: (
    token: string,
    orderId: string,
    reason?: string,
    line?: { itemId?: string; productId?: string },
  ) =>
    request<{
      success: boolean;
      message: string;
      order?: unknown;
    }>(`/order/my-orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "PATCH",
      headers: { "x-access-token": token },
      body: JSON.stringify({
        reason,
        ...(line?.itemId ? { itemId: line.itemId } : {}),
        ...(line?.productId ? { productId: line.productId } : {}),
      }),
    }),
  respondToQuote: (token: string, orderId: string, accepted: boolean) =>
    request<{ success: boolean; message: string; order?: unknown }>(
      `/order/my-orders/${encodeURIComponent(orderId)}/quote`,
      {
        method: "PATCH",
        headers: { "x-access-token": token },
        body: JSON.stringify({ action: accepted ? "ACCEPT" : "REJECT" }),
      },
    ),
};

export { API_BASE_URL };
