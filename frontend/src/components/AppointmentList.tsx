import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  CircularProgress,
  Box,
  Typography,
  IconButton,
  Tooltip
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";

type Appointment = {
  id: string;
  inquiry_id?: string | null;
  therapist_id?: string | null;
  patient_identifier?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  google_calendar_event_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  therapist_name?: string | null;
};

export default function AppointmentList() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-admin-data', {
        method: "GET"
      });

      if (error) {
        console.error("Error fetching appointments:", error);
        setAppointments([]);
        return;
      }

      setAppointments(data.appointments ?? []);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCancel = async (appointmentId: string) => {
    if (!confirm("Cancel this appointment? This will delete the event from the therapist's calendar.")) return;
    setActionLoadingId(appointmentId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${import.meta.env.VITE_FUNCTIONS_BASE}/cancel-appointment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ appointmentId }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? JSON.stringify(json));
      }

      await fetchAppointments();
    } catch (err: any) {
      console.error("Cancel failed:", err);
      alert("Failed to cancel appointment: " + (err.message ?? err));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          startIcon={<RefreshIcon />}
          onClick={fetchAppointments}
          disabled={loading}
          variant="outlined"
          size="small"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </Box>

      {loading && appointments.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : appointments.length === 0 ? (
        <Typography color="text.secondary">No appointments found.</Typography>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table sx={{ minWidth: 650 }} aria-label="appointments table">
            <TableHead sx={{ bgcolor: 'background.default' }}>
              <TableRow>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                <TableCell>Therapist</TableCell>
                <TableCell>Patient ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {appointments.map((a) => (
                <TableRow key={a.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell>{a.start_time ? new Date(a.start_time).toLocaleString() : "-"}</TableCell>
                  <TableCell>{a.end_time ? new Date(a.end_time).toLocaleString() : "-"}</TableCell>
                  <TableCell>{a.therapist_name ?? a.therapist_id ?? "-"}</TableCell>
                  <TableCell>{a.patient_identifier ?? "-"}</TableCell>
                  <TableCell>{a.status ?? "-"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Calendar Event">
                      <IconButton
                        onClick={() => {
                          if (a.google_calendar_event_id && a.start_time) {
                            // Extract date for Google Calendar URL
                            const eventDate = new Date(a.start_time);
                            const dateStr = eventDate.toISOString().split('T')[0].replace(/-/g, '');
                            // Open Google Calendar at this date
                            const url = `https://calendar.google.com/calendar/u/0/r/day/${dateStr}`;
                            window.open(url, "_blank");
                          } else {
                            // Fallback to main calendar if sync failed or ID missing
                            alert("This appointment doesn't have a linked Google Calendar event ID. Opening your main calendar.");
                            window.open("https://calendar.google.com", "_blank");
                          }
                        }}
                        size="small"
                        color="primary"
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Cancel Appointment">
                      <IconButton
                        onClick={() => handleCancel(a.id)}
                        disabled={actionLoadingId === a.id}
                        size="small"
                        color="error"
                      >
                        {actionLoadingId === a.id ? <CircularProgress size={20} /> : <DeleteIcon />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
