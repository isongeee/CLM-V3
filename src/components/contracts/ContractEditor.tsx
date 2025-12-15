import { useEffect, useMemo, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useCompany } from '../../contexts/CompanyContext'
import { contractsService } from '../../services/contractsService'
import type { Contract } from '../../types'
import Button from '../ui/Button'
import Card from '../ui/Card'

export default function ContractEditor({
  contract,
  onContractChange
}: {
  contract: Contract & { content: string | null }
  onContractChange: (next: Contract & { content: string | null }) => void
}) {
  const { activeCompanyId, can } = useCompany()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initialContent = useMemo(() => contract.content ?? '', [contract.content])

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent
  })

  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(initialContent, false)
  }, [editor, initialContent])

  return (
    <Card className="grid gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Editor</div>
        <Button
          onClick={async () => {
            if (!activeCompanyId) return
            if (!can('contracts.update')) {
              setError('Missing permission: contracts.update')
              return
            }
            if (!editor) return
            setIsSaving(true)
            setError(null)
            try {
              const html = editor.getHTML()
              await contractsService.saveNewVersion(activeCompanyId, contract.id, html)
              onContractChange({ ...contract, content: html })
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to save')
            } finally {
              setIsSaving(false)
            }
          }}
          disabled={!editor || isSaving}
        >
          {isSaving ? 'Saving…' : 'Save version'}
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="rounded-md border bg-white p-3">
        <EditorContent editor={editor} />
      </div>
      <div className="text-xs text-slate-500">Saving creates a new `contract_versions` row.</div>
    </Card>
  )
}

