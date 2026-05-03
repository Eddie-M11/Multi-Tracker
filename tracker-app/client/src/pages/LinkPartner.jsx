import { useState } from 'react';
import { Link } from 'react-router-dom';

import '../styles/linkPartner.css';

function LinkPartner() {
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  async function handleCreateInvite() {
    setLoadingCreate(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/relationship/create', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create invite code');
      }

      setInviteCode(data.inviteCode);
      setMessage('Invite code created. Share it with your partner!');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingCreate(false);
    }
  }

  async function handleJoin(event) {
    event.preventDefault();
    setLoadingJoin(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/relationship/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ inviteCode: joinCode }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to join relationship');
      }

      setMessage('Success! You are now linked with your partner.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingJoin(false);
    }
  }

  return (
    <main className="link-page">
      <section className="link-card">
        <Link to="/dashboard" className="back-link">Back to dashboard</Link>
        <h1>Link Your Partner</h1>

        <button type="button" className="primary-btn" onClick={handleCreateInvite} disabled={loadingCreate}>
          {loadingCreate ? 'Creating...' : 'Create Invite Code'}
        </button>

        {inviteCode && (
          <p className="invite-display">
            Invite Code: <strong>{inviteCode}</strong>
          </p>
        )}

        <form className="join-form" onSubmit={handleJoin}>
          <label htmlFor="inviteCode">Enter Invite Code</label>
          <input
            id="inviteCode"
            name="inviteCode"
            type="text"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            required
          />

          <button type="submit" className="primary-btn" disabled={loadingJoin}>
            {loadingJoin ? 'Joining...' : 'Join'}
          </button>
        </form>

        {message && <p className="success-text">{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>
    </main>
  );
}

export default LinkPartner;
