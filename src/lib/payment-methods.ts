export type PaymentMethodMode = 'url' | 'details'

export interface PaymentMethod {
  id: string
  name: string
  badge: string
  color: string
  mode: PaymentMethodMode
  slug: string
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "stripe", name: "Stripe Connect", badge: "S", color: "#635bff", mode: "url", slug: "stripe" },
  { id: "local", name: "Local transfer", badge: "₿", color: "#2b6cb0", mode: "details", slug: "" },
  { id: "intl", name: "International transfer", badge: "🌐", color: "#d69e2e", mode: "details", slug: "" },
  { id: "paypal", name: "PayPal", badge: "P", color: "#0070ba", mode: "url", slug: "paypal" },
  { id: "square", name: "Square", badge: "■", color: "#3e4348", mode: "url", slug: "square" },
  { id: "revolut", name: "Revolut", badge: "R", color: "#191c1f", mode: "url", slug: "revolut" },
  { id: "wise", name: "Wise", badge: "⇋", color: "#163300", mode: "details", slug: "wise" },
  { id: "monzo", name: "Monzo", badge: "M", color: "#ff4f40", mode: "url", slug: "monzo" },
  { id: "cashapp", name: "Cash App", badge: "$", color: "#00d632", mode: "url", slug: "cashapp" },
  { id: "venmo", name: "Venmo", badge: "V", color: "#3d95ce", mode: "url", slug: "venmo" },
  { id: "razorpay", name: "Razorpay", badge: "R", color: "#0c2451", mode: "url", slug: "razorpay" },
  { id: "instamojo", name: "Instamojo", badge: "i", color: "#5a55ca", mode: "url", slug: "instamojo" },
  { id: "paystack", name: "Paystack", badge: "≡", color: "#00c3f7", mode: "url", slug: "paystack" },
  { id: "flutterwave", name: "Flutterwave", badge: "F", color: "#f5a623", mode: "url", slug: "flutter" },
  { id: "mercadopago", name: "Mercado Pago", badge: "M", color: "#00b1ea", mode: "url", slug: "mercadopago" },
  { id: "pagseguro", name: "PagSeguro", badge: "P", color: "#fcb22d", mode: "url", slug: "pagseguro" },
  { id: "conekta", name: "Conekta", badge: "C", color: "#0a2540", mode: "url", slug: "" },
  { id: "esewa", name: "eSewa", badge: "e", color: "#60bb46", mode: "details", slug: "esewa" },
  { id: "khalti", name: "Khalti", badge: "K", color: "#5c2d91", mode: "details", slug: "" },
  { id: "gcash", name: "GCash", badge: "G", color: "#0070e0", mode: "details", slug: "gcash" },
  { id: "maya", name: "Maya", badge: "m", color: "#00d6a0", mode: "details", slug: "" },
  { id: "phonepe", name: "PhonePe", badge: "प", color: "#5f259f", mode: "details", slug: "phonepe" },
  { id: "gpay", name: "Google Pay", badge: "G", color: "#4285f4", mode: "details", slug: "googlepay" },
  { id: "paytm", name: "Paytm", badge: "P", color: "#00baf2", mode: "details", slug: "paytm" },
  { id: "zelle", name: "Zelle", badge: "Z", color: "#6d1ed4", mode: "details", slug: "zelle" },
  { id: "alipay", name: "Alipay", badge: "支", color: "#1677ff", mode: "details", slug: "alipay" },
  { id: "wechat", name: "WeChat Pay", badge: "微", color: "#07c160", mode: "details", slug: "wechat" },
  { id: "payoneer", name: "Payoneer", badge: "P", color: "#ff4800", mode: "url", slug: "payoneer" },
  { id: "mollie", name: "Mollie", badge: "M", color: "#000000", mode: "url", slug: "mollie" },
  { id: "klarna", name: "Klarna", badge: "K", color: "#ffb3c7", mode: "url", slug: "klarna" },
  { id: "skrill", name: "Skrill", badge: "S", color: "#862165", mode: "url", slug: "skrill" },
  { id: "mpesa", name: "M-Pesa", badge: "M", color: "#43b02a", mode: "details", slug: "" },
  { id: "pix", name: "Pix", badge: "⬗", color: "#32bcad", mode: "details", slug: "pix" },
  { id: "ideal", name: "iDEAL", badge: "i", color: "#cc0066", mode: "url", slug: "ideal" },
  { id: "bizum", name: "Bizum", badge: "B", color: "#0a7bbe", mode: "details", slug: "bizum" },
]

export const PM_MAP: Record<string, PaymentMethod> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.id, m]),
)