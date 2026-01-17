import React, { useEffect, useRef, useState } from "react";
import "./Dashboard.css";

const Webhooks = () => {
  const [merchant, setMerchant] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Track retry state per row (so UI updates instantly)
  const [retryingIds, setRetryingIds] = useState({});

  // Prevent state updates after unmount
  const isMountedRef = useRef(true);

  const fetchMerchant = async () => {
    const res = await fetch("http://localhost:8000/api/v1/test/merchant");
    if (!res.ok) throw new Error("Failed to fetch merchant");
    return res.json();
  };

  const fetchLogs = async (m) => {
    const res = await fetch(
      "http://localhost:8000/api/v1/webhooks?limit=10&offset=0",
      {
        headers: {
          "X-Api-Key": m.api_key,
          "X-Api-Secret": m.api_secret,
        },
      }
    );

    if (!res.ok) throw new Error("Failed to fetch webhook logs");

    const data = await res.json();
    if (!isMountedRef.current) return;

    setLogs(data.data || []);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setMsg("");

      const m = await fetchMerchant();
      if (!isMountedRef.current) return;

      setMerchant(m);
      await fetchLogs(m);
    } catch (err) {
      if (!isMountedRef.current) return;
      setMsg(err.message || "Failed to load webhooks");
    } finally {
      if (!isMountedRef.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadAll();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Auto refresh logs for a few seconds after retry,
  // so delivered status appears without manual reload.
  const refreshAfterRetry = async (m) => {
    // Try multiple times because worker may deliver after a short delay
    const attempts = 6; // total ~12 seconds
    for (let i = 0; i < attempts; i++) {
      if (!isMountedRef.current) return;

      await fetchLogs(m);

      // wait 2 seconds
      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const retryWebhook = async (id) => {
    if (!merchant) return;

    // Instantly update UI so user sees pending without reload
    setLogs((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              status: "pending",
              last_error: null,
              next_retry_at: null,
            }
          : w
      )
    );

    setRetryingIds((prev) => ({ ...prev, [id]: true }));

    try {
      setMsg("");

      const res = await fetch(
        `http://localhost:8000/api/v1/webhooks/${id}/retry`,
        {
          method: "POST",
          headers: {
            "X-Api-Key": merchant.api_key,
            "X-Api-Secret": merchant.api_secret,
          },
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setMsg(data?.error?.description || "Retry failed");
        return;
      }

      setMsg(`Retry scheduled for webhook event ${id}`);

      // Refresh logs multiple times so delivered status updates automatically
      await refreshAfterRetry(merchant);
    } catch (err) {
      setMsg("Retry failed");
    } finally {
      setRetryingIds((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  return (
    <div className="dashboard" data-test-id="webhook-config">
      <h1 className="dashboard-title">Webhooks</h1>

      {msg && (
        <div style={{ marginBottom: "20px", color: "#1f2937" }}>{msg}</div>
      )}

      <div className="credential-card" style={{ marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "10px" }}>Webhook Configuration</h3>

        <div style={{ fontSize: "14px", color: "#6b7280" }}>
          Current URL is configured in backend table <b>webhook_endpoints</b>.
        </div>

        {merchant && (
          <div style={{ marginTop: "14px" }}>
            <div style={{ fontSize: "13px", color: "#6b7280" }}>Secret</div>
            <div style={{ fontFamily: "monospace", marginTop: "6px" }}>
              whsec_test_123
            </div>
          </div>
        )}
      </div>

      <div className="credential-card">
        <h3 style={{ marginBottom: "14px" }}>Webhook Delivery Logs</h3>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <table data-test-id="webhook-logs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Event</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Last Error</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6">No webhook logs found</td>
                </tr>
              ) : (
                logs.map((w) => {
                  const isRetrying = !!retryingIds[w.id];
                  const disableRetry =
                    isRetrying || String(w.status).toLowerCase() === "pending";

                  return (
                    <tr key={w.id} data-test-id="webhook-log-item">
                      <td>{w.id}</td>
                      <td data-test-id="webhook-event">{w.event_type}</td>
                      <td data-test-id="webhook-status">{w.status}</td>
                      <td data-test-id="webhook-attempts">{w.attempts}</td>
                      <td style={{ maxWidth: "260px", wordBreak: "break-word" }}>
                        {w.last_error || "-"}
                      </td>
                      <td>
                        <button
                          data-test-id="retry-webhook-button"
                          onClick={() => retryWebhook(w.id)}
                          disabled={disableRetry}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            opacity: disableRetry ? 0.6 : 1,
                            cursor: disableRetry ? "not-allowed" : "pointer",
                          }}
                        >
                          {isRetrying ? "Retrying..." : "Retry"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Webhooks;
