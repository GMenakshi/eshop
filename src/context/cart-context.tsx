import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    type PropsWithChildren,
} from "react";

import { catalog } from "@/constants/catalog";
import { useAuth } from "@/context/auth-context";
import {
    api,
    type ApiCartItem,
    type ApiCartResponse,
    type ApiProduct,
    type ApiSizeVariant,
    type ApiVariant,
} from "@/lib/api";
import { useStore } from "@/lib/store-context";
import { pickGst } from "@/lib/gst";

type CartProduct = ApiProduct | (typeof catalog)[keyof typeof catalog];
export type CartItem = {
  id: string;
  lineId?: string;
  cartItemId?: string;
  storeId?: string;
  storeName?: string;
  isAvailable?: boolean;
  quantity: number;
  product: CartProduct;
  variantLabel?: string;
};
type CartContextValue = {
  items: CartItem[];
  cartId: string | null;
  loading: boolean;
  clearCart: () => Promise<void>;
  addItem: (product: CartProduct, quantity?: number) => Promise<void>;
  changeQuantity: (item: CartItem, amount: number) => Promise<void>;
  removeItem: (item: CartItem) => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);
const getName = (product: CartProduct) =>
  "title" in product ? product.title : product.name;

function cartItemsFromResponse(response: ApiCartResponse) {
  const value = response.cart ?? response.data;
  if (Array.isArray(value)) return value;

  if (value?.stores?.length) {
    return value.stores.flatMap((s) =>
      (s.items ?? []).map((item) => ({
        ...item,
        storeId: s.store?._id,
        storeName: s.store?.storeName,
      })),
    );
  }

  return value?.items ?? response.cartItems ?? [];
}

function cartProductId(item: ApiCartItem) {
  const value = item.product?._id ?? item.productId;
  return typeof value === "string" ? value : (value?._id ?? value?.id);
}

const selectedVariantId = (product: CartProduct) =>
  "variantId" in product && product.variantId ? product.variantId : undefined;

const selectedColorVariantId = (product: CartProduct) =>
  "colorVariantId" in product && typeof product.colorVariantId === "string"
    ? product.colorVariantId
    : undefined;

const cartLineId = (
  productId: string,
  variantId?: string,
  colorVariantId?: string,
  size?: string,
  weight?: string | number,
) => {
  const options = [size, weight].filter(Boolean).join(":");
  const variantKey = variantId ?? colorVariantId ?? (options || "default");
  return `${productId}:${variantKey}`;
};

const getCartItemLineId = (item: CartItem) => item.lineId ?? item.id;

const productVariantLabel = (product: CartProduct) => {
  const color = "color" in product ? String(product.color ?? "").trim() : "";
  const size = "size" in product ? product.size : undefined;
  const weight = "weight" in product ? product.weight : undefined;
  const catalogVariant =
    "variant" in product && typeof product.variant === "string"
      ? product.variant
      : "";
  const options = [
    color ? `Color: ${color}` : "",
    size ? `Size: ${size}` : "",
    weight ? `Weight: ${weight}` : "",
  ].filter(Boolean);
  return options.join(" · ") || catalogVariant;
};

function applyCartVariant(product: ApiProduct, item: ApiCartItem): ApiProduct {
  const variantId = item.variantId;
  let matchedGroup: ApiVariant | undefined;
  let matchedSize: ApiSizeVariant | undefined;

  for (const group of product.variants ?? []) {
    const sizeVariant = group.sizeVariants?.find(
      (variant) =>
        Boolean(variantId) &&
        (variant._id === variantId || variant.id === variantId),
    );
    if (sizeVariant) {
      matchedGroup = group;
      matchedSize = sizeVariant;
      break;
    }
    if (variantId && (group._id === variantId || group.id === variantId)) {
      matchedGroup = group;
      break;
    }
  }

  if (
    !matchedGroup &&
    (item.size || item.weight || item.color || item.colorVariantId)
  ) {
    matchedGroup = product.variants?.find(
      (group) =>
        (item.colorVariantId
          ? group._id === item.colorVariantId ||
            group.id === item.colorVariantId
          : !item.color || group.color === item.color) &&
        (!item.size && !item.weight
          ? true
          : group.sizeVariants?.some(
              (variant) =>
                (!item.size || variant.size === item.size) &&
                (!item.weight || variant.weight === item.weight),
            )),
    );
    matchedSize = matchedGroup?.sizeVariants?.find(
      (variant) =>
        (!item.size || variant.size === item.size) &&
        (!item.weight || variant.weight === item.weight),
    );
  }

  const offerPrice = Number(
    item.offerPrice ??
      matchedSize?.offerPrice ??
      matchedGroup?.offerPrice ??
      product.price,
  );
  const originalPrice = Number(
    item.mrp ??
      matchedSize?.mrp ??
      matchedGroup?.mrp ??
      product.originalPrice ??
      offerPrice,
  );
  const image = matchedGroup?.images?.[0] ?? product.image;
  const resolvedVariantId =
    variantId ??
    matchedSize?._id ??
    matchedSize?.id ??
    matchedGroup?._id ??
    matchedGroup?.id ??
    item.product?.variantId ??
    product.variantId;

  return {
    ...product,
    image,
    images: image ? [image] : product.images,
    price: Number.isFinite(offerPrice) ? offerPrice : product.price,
    originalPrice: Number.isFinite(originalPrice)
      ? originalPrice
      : product.originalPrice,
    size:
      item.size ??
      matchedSize?.size ??
      (matchedGroup ? undefined : product.size),
    weight:
      item.weight ??
      matchedSize?.weight ??
      (matchedGroup ? undefined : product.weight),
    variantId: resolvedVariantId,
    gst:
      pickGst(
        matchedSize?.effectiveGst,
        matchedGroup?.effectiveGst,
        product.gst,
      ) ?? product.gst,
    color: item.color ?? matchedGroup?.color,
    colorVariantId: item.colorVariantId ?? matchedGroup?._id,
  };
}

export const cartItemStoreId = (item: CartItem): string =>
  item.storeId ??
  ("storeId" in item.product ? item.product.storeId : undefined) ??
  "unknown";

export function CartProvider({ children }: PropsWithChildren) {
  const { token, signOut } = useAuth();
  const { storeId, activeStore } = useStore();
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const itemsRef = useRef<CartItem[]>([]);

  itemsRef.current = items;

  useEffect(() => {
    const mongoId = activeStore?.mongoId;
    const inActiveStore = (item: { storeId?: string }) =>
      !mongoId || !item.storeId || item.storeId === mongoId;

    if (!token || !storeId) {
      if (!token) {
        setItems([]);
        setCartId(null);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    console.log("[Cart] Hydrating cart context", {
      storeId,
      authenticated: Boolean(token),
    });
    api
      .cart(token)
      .then(async (response) => {
        const cartValue = response.cart ?? response.data;
        const cartObject =
          cartValue && !Array.isArray(cartValue) ? cartValue : undefined;
        const remoteItems =
          cartItemsFromResponse(response).filter(inActiveStore);

        const remoteIds = new Set(
          remoteItems.map(
            (item) =>
              item.product?._id ??
              (typeof item.productId === "string"
                ? item.productId
                : (item.productId?._id ?? item.productId?.id)),
          ),
        );
        const guestItems: CartItem[] = [];
        for (const item of guestItems) {
          if ("_id" in item.product && !remoteIds.has(item.product._id)) {
            try {
              const firstVariant =
                "variants" in item.product &&
                Array.isArray(item.product.variants)
                  ? item.product.variants[0]
                  : undefined;

              const variantId =
                ("variantId" in item.product && item.product.variantId) ||
                firstVariant?.sizeVariants?.[0]?._id ||
                firstVariant?.sizeVariants?.[0]?.id ||
                firstVariant?._id ||
                firstVariant?.id ||
                undefined;
              await api.addCart(token, item.product._id, item.quantity, {
                variantId,
                size: item.product.size,
                weight: item.product.weight,
              });
            } catch (error) {
              console.error("[Cart] Guest cart sync failed", {
                productId: item.product._id,
                quantity: item.quantity,
                error,
              });
            }
          }
        }

        const hydratedResponse = guestItems.some(
          (item) => "_id" in item.product && !remoteIds.has(item.product._id),
        )
          ? await api.cart(token)
          : response;
        const hydratedCartValue =
          hydratedResponse.cart ?? hydratedResponse.data;
        const hydratedCartObject =
          hydratedCartValue && !Array.isArray(hydratedCartValue)
            ? hydratedCartValue
            : undefined;
        const hydratedRemoteItems =
          cartItemsFromResponse(hydratedResponse).filter(inActiveStore);
        console.log(
          "[Cart] hydrated items",
          hydratedRemoteItems.map((i) => ({
            name: i.name,
            storeName: i.storeName,
            storeId: i.storeId,
          })),
          
        );
        setCartId(
          hydratedResponse.cartId ??
            hydratedResponse._id ??
            hydratedCartObject?._id ??
            null,
        );
        const products = await api.products(storeId);
        const hydratedItems = await Promise.all(
          hydratedRemoteItems.map(async (item) => {
            const productId =
              item.product?._id ??
              (typeof item.productId === "string"
                ? item.productId
                : (item.productId?._id ?? item.productId?.id));
            const listProduct = productId
              ? products.products.find((entry) => entry._id === productId)
              : undefined;

            let product = item.product ?? listProduct;
            if (!product && productId && item.name) {
              const offerPrice = Number(item.offerPrice ?? 0);
              const mrp = Number(item.mrp ?? offerPrice);
              product = {
                _id: productId,
                title: item.name,
                description: "",
                price: Number.isFinite(offerPrice) ? offerPrice : 0,
                originalPrice: Number.isFinite(mrp) ? mrp : undefined,
                image: item.image ?? undefined,
                images: item.image ? [item.image] : [],
                categoryId: undefined,
                unit: item.unit,
                size: item.size ?? undefined,
                weight: item.weight ?? undefined,
                productCode: item.productCode,
                storeId: item.storeId,
              };
            }
            if (productId && (Boolean(listProduct) || !item.name)) {
              try {
                const detail = await api.product(storeId, productId);
                product = detail.product ?? product;
              } catch {
                console.warn(
                  "[Cart] Product detail unavailable; using cart snapshot",
                  {
                    productId,
                  },
                );
              }
            }

            const variantProduct = product
              ? applyCartVariant(product, item)
              : null;
            return variantProduct
              ? {
                  id: productId ?? variantProduct._id,
                  lineId:
                    item._id ??
                    cartLineId(
                      productId ?? variantProduct._id,
                      variantProduct.variantId,
                      variantProduct.colorVariantId,
                      variantProduct.size,
                      variantProduct.weight,
                    ),
                  cartItemId: item._id,
                  storeId: item.storeId ?? variantProduct.storeId,
                  storeName: item.storeName,
                  isAvailable: item.isAvailable !== false,
                  quantity: item.quantity,
                  product: variantProduct,
                  variantLabel: productVariantLabel(variantProduct),
                }
              : null;
          }),
        );
        setItems(
          hydratedItems.flatMap((item) =>
            item && item.id
              ? [{ ...item, product: item.product as CartProduct }]
              : [],
          ),
        );
        setLoading(false);
        console.log("[Cart] Cart state hydrated", {
          cartId:
            hydratedResponse.cartId ??
            hydratedResponse._id ??
            hydratedCartObject?._id ??
            null,
          itemCount: hydratedItems.filter(Boolean).length,
        });
      })
      .catch((error) => {
        console.error("[Cart] Backend cart load failed", error);
        if ((error as { status?: number })?.status === 401) {
          console.warn("[Auth] Cart token was rejected; signing out.");
          signOut();
        }
        if (
          error instanceof Error &&
          error.message.toLowerCase().includes("cart not found")
        )
          setItems([]);
        setCartId(null);
        setLoading(false);
      });
  }, [token, storeId, activeStore?.mongoId, signOut]);

  const addItem = async (product: CartProduct, quantity = 1) => {
    if (!token) {
      throw new Error("Please sign in to add products to your cart.");
    }
    let persistedCartItem: ApiCartItem | undefined;
    if (token && "_id" in product) {
      try {
        const firstVariant =
          "variants" in product && Array.isArray(product.variants)
            ? product.variants[0]
            : undefined;

        let variantId =
          ("variantId" in product && product.variantId) ||
          firstVariant?.sizeVariants?.[0]?._id ||
          firstVariant?.sizeVariants?.[0]?.id ||
          firstVariant?._id ||
          firstVariant?.id ||
          undefined;

        if (!variantId && storeId) {
          try {
            const detail = await api.product(storeId, product._id);
            const fetchedProduct = detail.product ?? detail.data;
            if (fetchedProduct?.variantId) {
              variantId = fetchedProduct.variantId;
            } else if (fetchedProduct?.variants?.length) {
              variantId =
                fetchedProduct.variants[0]._id ?? fetchedProduct.variants[0].id;
            }
          } catch (fetchErr) {
            console.warn(
              "[Cart] Failed to resolve variantId from API",
              fetchErr,
            );
          }
        }

        await api.addCart(token, product._id, quantity, {
          variantId,
          size: product.size,
          weight: product.weight,
        });
        const savedCart = await api.cart(token);
        const savedValue = savedCart.cart ?? savedCart.data;
        const savedObject =
          savedValue && !Array.isArray(savedValue) ? savedValue : undefined;
        const savedItems = cartItemsFromResponse(savedCart);
        const sameProductItems = savedItems.filter(
          (item) => cartProductId(item) === product._id,
        );
        persistedCartItem =
          sameProductItems.find((item) => item.variantId === variantId) ??
          sameProductItems.find(
            (item) =>
              item.size === product.size && item.weight === product.weight,
          ) ??
          (sameProductItems.length === 1 ? sameProductItems[0] : undefined);
        console.log("[Cart] Add persistence check", {
          productId: product._id,
          saved: sameProductItems.length > 0,
          savedCartId:
            savedCart.cartId ?? savedCart._id ?? savedObject?._id ?? null,
          savedItemId: persistedCartItem?._id,
          savedQuantity: persistedCartItem?.quantity,
        });
        if (sameProductItems.length === 0) {
          throw new Error(
            "Cart add returned success, but the item was not saved.",
          );
        }
        setCartId(
          savedCart.cartId ?? savedCart._id ?? savedObject?._id ?? null,
        );
      } catch (error) {
        console.error("[Cart] Add product failed", {
          productId: product._id,
          quantity,
          error,
        });
        throw error;
      }
    }
    const productId = "_id" in product ? product._id : getName(product);
    const variantId = selectedVariantId(product);
    const colorVariantId = selectedColorVariantId(product);
    const size = "size" in product ? product.size : undefined;
    const weight = "weight" in product ? product.weight : undefined;
    const lineId = cartLineId(
      productId,
      variantId,
      colorVariantId,
      size,
      weight,
    );
    setItems((current) => {
      const existing = current.find(
        (item) =>
          item.lineId === lineId ||
          Boolean(
            persistedCartItem?._id && item.cartItemId === persistedCartItem._id,
          ),
      );
      if (existing) {
        return current.map((item) =>
          item === existing
            ? {
                ...item,
                cartItemId: persistedCartItem?._id ?? item.cartItemId,
                quantity: item.quantity + quantity,
              }
            : item,
        );
      }
      return [
        ...current,
        {
          id: productId,
          lineId,
          cartItemId: persistedCartItem?._id,
          storeId: "storeId" in product ? product.storeId : undefined,
          product,
          quantity,
          variantLabel: productVariantLabel(product),
        },
      ];
    });
  };
  const changeQuantity = async (item: CartItem, amount: number) => {
    const nextQuantity = item.quantity + amount;

    if (nextQuantity <= 0) {
      await removeItem(item);
      return;
    }

    if (token && item.cartItemId) {
      try {
        await api.updateCartItem(token, item.cartItemId, nextQuantity);
      } catch (error) {
        console.error("[Cart] Backend quantity update failed", {
          cartItemId: item.cartItemId,
          quantity: nextQuantity,
          error,
        });
        return; // keep the item as-is if the backend update fails
      }
    } else if (token && amount > 0 && "_id" in item.product) {
      try {
        const firstVariant =
          "variants" in item.product && Array.isArray(item.product.variants)
            ? item.product.variants[0]
            : undefined;

        const variantId =
          ("variantId" in item.product && item.product.variantId) ||
          firstVariant?.sizeVariants?.[0]?._id ||
          firstVariant?.sizeVariants?.[0]?.id ||
          firstVariant?._id ||
          firstVariant?.id ||
          undefined;

        await api.addCart(token, item.product._id, amount, {
          variantId,
          size: item.product.size,
          weight: item.product.weight,
        });
      } catch (error) {
        console.error("[Cart] Backend quantity add failed", {
          productId: item.product._id,
          quantity: amount,
          error,
        });
        // Backend unavailable; continue with local state
      }
    }
    setItems((current) =>
      current.flatMap((entry) => {
        if (getCartItemLineId(entry) !== getCartItemLineId(item))
          return [entry];
        const quantity = entry.quantity + amount;
        return quantity > 0 ? [{ ...entry, quantity }] : [];
      }),
    );
  };
  const clearCart = async () => {
    if (token) {
      try {
        await api.clearCart(token);
      } catch (error) {
        console.error("[Cart] Backend clear failed", error);
        // Continue clearing local state even if the backend call fails
      }
    }
    setItems([]);
    setCartId(null);
  };

  const removeItem = async (item: CartItem) => {
    if (token && item.cartItemId) {
      try {
        await api.removeCartItem(token, item.cartItemId);
      } catch {
        // Backend unavailable; continue with local state
      }
    }
    setItems((current) =>
      current.filter(
        (entry) => getCartItemLineId(entry) !== getCartItemLineId(item),
      ),
    );
  };

  return (
    <CartContext.Provider
      value={{
        items,
        cartId,
        loading,
        clearCart,
        addItem,
        changeQuantity,
        removeItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
