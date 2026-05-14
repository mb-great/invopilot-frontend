import AuthForm from '@/components/auth/AuthForm'

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-ink-50">
      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* Left Side: Auth Form */}
        <div className="flex items-center justify-center px-8 py-12 bg-white lg:bg-ink-50">
          <AuthForm mode="signup" />
        </div>

        {/* Right Side: Hero Content */}
        <div className="hidden lg:flex bg-ink-900 text-white p-16 items-center relative overflow-hidden">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-brand-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-500/5 rounded-full blur-[120px]" />
          
          <div className="max-w-md relative z-10">
            <h2 className="text-6xl font-bold mb-6 tracking-tighter leading-tight">
              Start invoicing, <br/>
              <span className="headline-accent italic font-serif font-normal text-brand-400">instantly.</span>
            </h2>
            <p className="text-ink-300 mb-12 text-xl leading-relaxed">
              Create professional invoices in under a minute. Track payments, share with clients, and get paid faster.
            </p>
            
            <div className="space-y-5">
              {[
                "Free to start — no credit card needed",
                "Generate PDF invoices in seconds",
                "Share via link or email",
                "Track who paid and who didn't"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_12px_rgba(243,156,91,0.6)] group-hover:scale-125 transition-transform" />
                  <span className="text-ink-200 text-lg group-hover:text-white transition-colors">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
