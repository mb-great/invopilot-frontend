import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function testOtp() {
  const email = 'test_otp_verify@example.com'
  
  console.log('Sending OTP...')
  const { data, error } = await supabase.auth.signInWithOtp({ email })
  if (error) {
    console.error('Send error:', error)
    return
  }
  
  console.log('Send success. Check email inbox for OTP, but since we cant, we will just try to verify with a wrong OTP to see the error.')
  
  console.log('Verifying OTP with type email...')
  const verify1 = await supabase.auth.verifyOtp({ email, token: '123456', type: 'email' })
  console.log('Verify email result:', verify1.error?.message)
  
  console.log('Verifying OTP with type signup...')
  const verify2 = await supabase.auth.verifyOtp({ email, token: '123456', type: 'signup' })
  console.log('Verify signup result:', verify2.error?.message)
}

testOtp()
