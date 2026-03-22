import { useState, useEffect } from 'react';
import {
  Paper, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Chip,
} from '@mui/material';
import { rewardsApi, Transaction } from '../api/rewards';

export default function PointsHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    rewardsApi
      .getHistory(rowsPerPage, page * rowsPerPage)
      .then((data) => {
        setTransactions(data.transactions);
        setTotal(data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, rowsPerPage]);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={600} gutterBottom>
        Points History
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Table</TableCell>
              <TableCell align="right">Base</TableCell>
              <TableCell align="right">Multiplier</TableCell>
              <TableCell align="right">Earned</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">Loading...</TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">No transactions yet</TableCell>
              </TableRow>
            ) : (
              transactions.map((tx, i) => (
                <TableRow key={`${tx.timestamp}-${i}`}>
                  <TableCell>
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={tx.type}
                      size="small"
                      color={tx.type === 'gameplay' ? 'primary' : 'secondary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{tx.tableStakes || '—'}</TableCell>
                  <TableCell align="right">{tx.basePoints}</TableCell>
                  <TableCell align="right">{tx.multiplier}x</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {tx.earnedPoints > 0 ? '+' : ''}{tx.earnedPoints}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[5, 10, 20]}
      />
    </Paper>
  );
}
