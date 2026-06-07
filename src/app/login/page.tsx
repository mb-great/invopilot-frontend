import AuthForm from '@/components/auth/AuthForm'

export default function LoginPage() {
  return (
    <main className="min-h-[100dvh] bg-ink-50">
      <div className="grid lg:grid-cols-2 min-h-[100dvh]">
        {/* Left Side: Auth Form */}
        <div className="flex items-center justify-center px-8 py-12 bg-white lg:bg-ink-50">
          <AuthForm />
        </div>

        {/* Right Side: Hero Content */}
        <div className="hidden lg:flex bg-ink-900 text-white p-16 items-center relative overflow-hidden">
          {/* Decorative accents */}
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-brand-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-500/5 rounded-full blur-[120px]" />
          
          <div className="max-w-md relative z-10">
            <h2 className="text-6xl font-bold mb-6 tracking-tighter leading-tight">
              Your invoices, <br/>
              <span className="headline-accent italic font-serif font-normal text-brand-400">tracked.</span>
            </h2>
            <p className="text-ink-300 mb-12 text-xl leading-relaxed">
              Sign in to see who paid, who&apos;s overdue, and how much you&apos;ve invoiced this month — all in one clean dashboard.
            </p>
            
            <div className="space-y-5">
              {[
                "Track payment status across all your clients",
                "See revenue trends and top clients",
                "GST-ready quarterly tax summaries",
                "All invoices saved — never lose one"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <div className="w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_12px_rgba(243,156,91,0.6)] group-hover:scale-125 transition-transform" />
                  <span className="text-ink-200 text-lg group-hover:text-white transition-colors">{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-16 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <p className="text-ink-400 text-sm italic">
                &quot;InvoPilot changed how I handle my freelancing. No more messy spreadsheets or lost PDFs.&quot;
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center text-brand-800 font-bold text-xs">JD</div>
                <span className="text-sm font-semibold">Jane Doe, Independent Designer</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
