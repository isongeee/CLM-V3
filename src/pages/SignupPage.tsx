import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useAuth } from '../contexts/AuthContext'

export default function SignupPage() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center p-6">
      <Card className="w-full">
        <h1 className="text-lg font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-slate-600">You can join or create companies after login.</p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            const result = await signUp({ email, password })
            if (result.ok) navigate('/app/dashboard', { replace: true })
            else setError(result.error)
          }}
        >
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          <Button type="submit">Create account</Button>
        </form>
        <div className="mt-4 text-sm text-slate-600">
          Have an account? <Link className="text-slate-900 underline" to="/login">Sign in</Link>
        </div>
      </Card>
    </div>
  )
}

