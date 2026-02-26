import React, { ReactNode } from 'react';
import MuiTable from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import MuiTableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';

interface TableProps {
  headings?: string[];
  children?: ReactNode;
}

const Table: React.FC<TableProps> = (props) => {
  const headings = props.headings?.map((heading) => (
    <TableCell
      key={heading}
      sx={{
        color: 'common.white',
        fontWeight: 600,
        fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem' },
        backgroundColor: 'primary.dark',
        borderRight: (theme) => `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
        '&:last-child': { borderRight: 'none' },
        py: 1.25,
        px: 1.5,
        textAlign: 'center',
        letterSpacing: '0.02em',
        ...(heading === 'Due Date (D/M/Y)' && {
          display: { xs: 'none', sm: 'table-cell' },
        }),
      }}
    >
      {heading}
    </TableCell>
  ));

  return (
    <TableContainer
      component={Paper}
      elevation={2}
      sx={{
        maxHeight: { xs: 220, sm: 250 },
        width: '90%',
        maxWidth: 700,
        mx: 'auto',
        borderRadius: 2,
        overflow: 'auto',
        '@media (min-height: 750px)': { maxHeight: 400 },
      }}
    >
      <MuiTable size="small" stickyHeader>
        <TableHead>
          <MuiTableRow>{headings}</MuiTableRow>
        </TableHead>
        <TableBody
          sx={{
            '& tr': {
              transition: 'background-color 0.15s ease',
              '&:hover': {
                backgroundColor: (theme) => alpha(theme.palette.primary.dark, 0.06),
              },
            },
            '& tr:nth-of-type(even)': {
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.15),
              '&:hover': {
                backgroundColor: (theme) => alpha(theme.palette.primary.dark, 0.1),
              },
            },
            '& td': {
              color: 'text.primary',
              fontSize: { xs: '0.75rem', sm: '0.85rem', md: '0.9rem' },
              py: 1,
              px: 1.5,
              borderRight: (theme) => `1px solid ${theme.palette.divider}`,
              '&:last-child': { borderRight: 'none' },
            },
          }}
        >
          {props.children}
        </TableBody>
      </MuiTable>
    </TableContainer>
  );
};

export default Table;
