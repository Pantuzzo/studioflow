import type { ReactNode } from 'react'
import { useGetClientsQuery } from './clientsApi'
import styles from './ClientsPage.module.css'

export function ClientsPage() {
  const { data: clients, isLoading, isError, refetch } = useGetClientsQuery()

  let content: ReactNode
  if (isLoading) {
    content = (
      <p role="status" className={styles.state}>
        Loading clients…
      </p>
    )
  } else if (isError) {
    content = (
      <div role="alert" className={styles.state}>
        <p>We couldn’t load your clients.</p>
        <button type="button" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    )
  } else if (!clients || clients.length === 0) {
    content = <p className={styles.state}>No clients yet.</p>
  } else {
    content = (
      <table className={styles.table}>
        <caption className="sf-visually-hidden">List of clients</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Company</th>
            <th scope="col">Email</th>
            <th scope="col">Currency</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>{client.name}</td>
              <td>{client.company}</td>
              <td>
                <a href={`mailto:${client.email}`}>{client.email}</a>
              </td>
              <td>{client.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Clients</h1>
        <p className={styles.subtitle}>People and companies you work with.</p>
      </header>
      {content}
    </div>
  )
}
