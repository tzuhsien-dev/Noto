import { useState } from 'react'
import { Archive, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer, PageHeader } from '@/components/PageHeader'
import { updateNote } from '@/db/repo/notes'
import { updateProject } from '@/db/repo/projects'
import { useNotes, useProjects } from '@/features/data/hooks'
import { NoteCard } from '@/features/notes/NoteCard'
import { DeleteProjectDialog } from '@/pages/ProjectsPage'
import type { Project } from '@/domain/types'

export function ArchivePage() {
  const notes = (useNotes() ?? []).filter((n) => n.archived && !n.deletedAt)
  const projects = (useProjects() ?? []).filter((p) => p.archived)
  const [deleting, setDeleting] = useState<Project | null>(null)

  return (
    <PageContainer>
      <PageHeader title="Archive" />
      {notes.length === 0 && projects.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Archive is empty"
          description="Archived notes and projects live here."
        />
      ) : (
        <div className="space-y-6">
          {notes.length > 0 ? (
            <section aria-label="Archived notes">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Notes</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {notes.map((note) => (
                  <div key={note.id} className="space-y-1">
                    <NoteCard note={note} />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void updateNote(note.id, { archived: false })}
                    >
                      Unarchive
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {projects.length > 0 ? (
            <section aria-label="Archived projects">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Projects</h2>
              <ul className="space-y-1">
                {projects.map((project) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                  >
                    {project.name}
                    <span className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void updateProject(project.id, { archived: false })}
                      >
                        Unarchive
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setDeleting(project)}
                        aria-label={`Delete ${project.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
      <DeleteProjectDialog project={deleting} onOpenChange={(open) => !open && setDeleting(null)} />
    </PageContainer>
  )
}
