import type { Attachment } from '~/types'

export function useAttachments () {
  async function uploadFiles (files: File[], links: Record<string, any> = {}): Promise<Attachment[]> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId || files.length === 0) return []
    const uploaded: Attachment[] = []
    const completedPrepared: { attachmentId: string; workspaceId: string }[] = []
    try {
      for (const file of files) {
        const prepared = await useApi<{ attachment: Attachment; uploadUrl: string }>(`/workspaces/${workspaceId}/attachments/upload-url`, {
          method: 'POST',
          body: {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            ...links
          }
        })
        try {
          await fetch(prepared.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file
          })
        } catch (uploadErr) {
          await useApi(`/workspaces/${workspaceId}/attachments/${prepared.attachment.id}`, {
            method: 'DELETE'
          }).catch(() => {})
          throw uploadErr
        }
        const completed = await useApi<Attachment>(`/workspaces/${workspaceId}/attachments/${prepared.attachment.id}/complete`, {
          method: 'POST',
          body: {}
        })
        completedPrepared.push({ attachmentId: completed.id, workspaceId })
        uploaded.push(completed)
      }
    } catch (err) {
      for (const { attachmentId, workspaceId: wsId } of completedPrepared) {
        await useApi(`/workspaces/${wsId}/attachments/${attachmentId}`, {
          method: 'DELETE'
        }).catch(() => {})
      }
      throw err
    }
    return uploaded
  }

  async function downloadUrl (attachmentId: string): Promise<string> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) throw new Error('No workspace selected')
    const res = await useApi<{ downloadUrl: string }>(`/workspaces/${workspaceId}/attachments/${attachmentId}/download-url`)
    return res.downloadUrl
  }

  return { uploadFiles, downloadUrl }
}