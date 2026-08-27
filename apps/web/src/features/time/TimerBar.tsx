import { observer } from 'mobx-react-lite'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { useGetProjectsQuery } from '@/features/projects/projectsApi'
import { useStartTimerMutation, useStopTimerMutation } from './timeEntriesApi'
import { formatDuration, type TimerStore } from './timerStore'
import styles from './TimeTrackingPage.module.css'

/**
 * The only component in the app wrapped in `observer`.
 *
 * That is the point of the boundary: one component re-renders once a second,
 * and it is the one displaying a clock. See README.md in this folder.
 */
export const TimerBar = observer(function TimerBar({
  store,
}: {
  store: TimerStore
}) {
  const { data: projects } = useGetProjectsQuery()
  const [startTimer, { isLoading: isStarting }] = useStartTimerMutation()
  const [stopTimer, { isLoading: isStopping }] = useStopTimerMutation()
  const { toast } = useToast()

  const [projectId, setProjectId] = useState('')
  const projectOptions = (projects ?? []).map((project) => ({
    value: project.id,
    label: `${project.name} · ${project.clientName}`,
  }))

  async function start() {
    try {
      const entry = await startTimer({
        projectId,
        description: store.draftDescription,
      }).unwrap()
      store.adopt(entry)
    } catch {
      toast({
        title: 'We couldn’t start that timer',
        description: 'Nothing was recorded.',
        variant: 'error',
      })
    }
  }

  async function stop() {
    if (!store.running) return
    try {
      await stopTimer(store.running.id).unwrap()
      store.adopt(null)
    } catch {
      toast({
        title: 'We couldn’t stop that timer',
        description: 'It is still running.',
        variant: 'error',
      })
    }
  }

  if (store.isRunning) {
    return (
      <div className={styles.timerBar} data-running="true">
        <div className={styles.timerText}>
          <p className={styles.timerProject}>{store.projectName}</p>
          <p className={styles.timerDescription}>
            {store.running?.description || 'No description'}
          </p>
        </div>
        {/*
          Announced politely: a clock that interrupts a screen reader every
          second would make the page unusable, so the number is readable on
          demand rather than shouted.
        */}
        <output className={styles.clock} aria-live="off">
          {formatDuration(store.elapsedSeconds)}
        </output>
        <Button onClick={() => void stop()} disabled={isStopping}>
          Stop
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.timerBar}>
      <Input
        aria-label="What are you working on?"
        placeholder="What are you working on?"
        className={styles.timerInput}
        value={store.draftDescription}
        onChange={(event) => store.setDraftDescription(event.target.value)}
      />
      <Select
        aria-label="Project"
        options={projectOptions}
        placeholder="Choose a project"
        value={projectId}
        onValueChange={setProjectId}
      />
      <Button onClick={() => void start()} disabled={!projectId || isStarting}>
        Start
      </Button>
    </div>
  )
})
