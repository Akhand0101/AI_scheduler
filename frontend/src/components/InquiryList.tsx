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
  CircularProgress,
  Chip,
  Box,
  Typography
} from "@mui/material";

export default function InquiryList() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const sessionResp = await supabase.auth.getSession();
      const token = sessionResp.data.session?.access_token;
      if (!token) { setLoading(false); return; }

      try {
        const res = await fetch(`${import.meta.env.VITE_FUNCTIONS_BASE}/get-admin-data`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        setItems(json.inquiries || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (items.length === 0) {
    return <Typography color="text.secondary">No inquiries found.</Typography>;
  }

  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
      <Table sx={{ minWidth: 650 }} aria-label="inquiries table">
        <TableHead sx={{ bgcolor: 'background.default' }}>
          <TableRow>
            <TableCell>Created</TableCell>
            <TableCell>Problem</TableCell>
            <TableCell>Insurance</TableCell>
            <TableCell>Specialty</TableCell>
            <TableCell>Matched</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((it: any) => (
            <TableRow key={it.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
              <TableCell component="th" scope="row">
                {new Date(it.created_at).toLocaleString()}
              </TableCell>
              <TableCell>{it.problem_description}</TableCell>
              <TableCell>{it.insurance_info}</TableCell>
              <TableCell>{it.extracted_specialty}</TableCell>
              <TableCell>{it.matched_therapist_id ?? "-"}</TableCell>
              <TableCell>
                <Chip
                  label={it.status}
                  size="small"
                  color={it.status === 'completed' ? 'success' : 'default'}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
