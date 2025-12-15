import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = useMemo(() => (location.state as any)?.from ?? '/app/dashboard', [location.state])

  return (
    <div className="mx-auto grid min-h-dvh max-w-md place-items-center p-6">
      <Card className="w-full">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-slate-600">Use your work email.</p>
        <form
          className="mt-4 grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            const result = await signInWithPassword({ email, password })
            if (result.ok) navigate(redirectTo, { replace: true })
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
          <Button type="submit">Sign in</Button>
        </form>
        <div className="mt-4 text-sm text-slate-600">
          No account? <Link className="text-slate-900 underline" to="/signup">Create one</Link>
        </div>
      </Card>
    </div>
  )
}

