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
import { api, type ApiCartItem, type ApiProduct } from "@/lib/api";
import { useStore } from "@/lib/store-context";

type CartProduct = ApiProduct | (typeof catalog)[keyof typeof catalog];
export type CartItem = {
  id: string;
  cartItemId?: string;
  storeId?: string;
  storeName?: string;      
  isAvailable?: boolean;   
  quantity: number;
  product: CartProduct;
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

function cartItemsFromResponse(response: {
  cart?: {
    items?: ApiCartItem[];
    stores?: { store?: { _id?: string; storeName?: string }; items?: ApiCartItem[] }[];
  };
  data?: typeof response.cart;
  cartItems?: ApiCartItem[];
}) {
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

export const cartItemStoreId = (item: CartItem): string =>
  item.storeId ??
  ("storeId" in item.product ? item.product.storeId : undefined) ??
  "unknown";

export function CartProvider({ children }: PropsWithChildren) {
  const { token, signOut } = useAuth();
  const { storeId } = useStore();
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); 
  const itemsRef = useRef<CartItem[]>([]);

  itemsRef.current = items;

  useEffect(() => {
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
        const remoteItems = cartItemsFromResponse(response);

        const remoteIds = new Set(
          remoteItems.map(
            (item) =>
              item.product?._id ??
              (typeof item.productId === "string"
                ? item.productId
                : (item.productId?._id ?? item.productId?.id)),
          ),
        );
        const guestItems = itemsRef.current;
        for (const item of guestItems) {
          if ("_id" in item.product && !remoteIds.has(item.product._id)) {
            try {
              const variantId =
                "variantId" in item.product && item.product.variantId
                  ? item.product.variantId
                  : "variants" in item.product &&
                    Array.isArray(item.product.variants) &&
                    item.product.variants.length > 0
                  ? item.product.variants[0]._id ?? item.product.variants[0].id
                  : undefined;
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
            const hydratedRemoteItems = cartItemsFromResponse(hydratedResponse);
         console.log("[Cart] hydrated items", hydratedRemoteItems.map(i => ({ name: i.name, storeName: i.storeName, storeId: i.storeId })));
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

return product
  ? {
      id: productId ?? product._id,
      cartItemId: item._id,
      storeId: item.storeId ?? product.storeId,
      storeName: item.storeName,
      isAvailable: item.isAvailable !== false,
      quantity: item.quantity,
      product,
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
  }, [token, storeId, signOut]);

  const addItem = async (product: CartProduct, quantity = 1) => {
    if (!token) {
      throw new Error("Please sign in to add products to your cart.");
    }
    if (token && "_id" in product) {
      try {
        let variantId =
          "variantId" in product && product.variantId
            ? product.variantId
            : "variants" in product &&
              Array.isArray(product.variants) &&
              product.variants.length > 0
            ? product.variants[0]._id ?? product.variants[0].id
            : undefined;

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
            console.warn("[Cart] Failed to resolve variantId from API", fetchErr);
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
        const savedItem = savedItems.find(
          (item) => cartProductId(item) === product._id,
        );
        console.log("[Cart] Add persistence check", {
          productId: product._id,
          saved: Boolean(savedItem),
          savedCartId:
            savedCart.cartId ?? savedCart._id ?? savedObject?._id ?? null,
          savedItemId: savedItem?._id,
          savedQuantity: savedItem?.quantity,
        });
        if (!savedItem) {
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
        setItems((current) => {
      const existing = current.find(
        (item) =>
          item.id === ("_id" in product ? product._id : getName(product)),
      );
      if (existing)
        return current.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      return [
        ...current,
        {
          id: "_id" in product ? product._id : getName(product),
          cartItemId: undefined,
          storeId: "storeId" in product ? product.storeId : undefined,
          product,
          quantity,
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
        if ((error as { status?: number })?.status === 404) {
          setItems((current) => current.filter((entry) => entry.id !== item.id));
          return;
        }
        // Backend unavailable for other reasons; continue with local state
      }
    } else if (token && amount > 0 && "_id" in item.product) {
      try {
        const variantId =
          "variantId" in item.product && item.product.variantId
            ? item.product.variantId
            : "variants" in item.product &&
              Array.isArray(item.product.variants) &&
              item.product.variants.length > 0
            ? item.product.variants[0]._id ?? item.product.variants[0].id
            : undefined;

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
        if (entry.id !== item.id) return [entry];
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
    setItems((current) => current.filter((entry) => entry.id !== item.id));
  };

  return (
    <CartContext.Provider
      value={{ items, cartId, loading, clearCart, addItem, changeQuantity, removeItem }}
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
