import React, { ReactNode } from 'react';
import MuiTable from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import MuiTableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
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
        borderBottom: (theme) => `3px solid ${theme.palette.common.white}`,
        fontWeight: 'bold',
        backgroundColor: 'primary.main',
        position: 'sticky',
        top: 0,
        zIndex: 1,
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
      sx={{
        height: { xs: 220, sm: 220 },
        width: '90%',
        maxWidth: 700,
        mx: 'auto',
        '@media (min-height: 600px)': { height: 250 },
        '@media (min-height: 750px)': { height: 400 },
      }}
    >
      <MuiTable size="small" stickyHeader sx={{ '& td, & th': { fontSize: { xs: '0.75em', sm: '0.85em', md: '1em' } } }}>
        <TableHead>
          <MuiTableRow>{headings}</MuiTableRow>
        </TableHead>
        <TableBody
          sx={{
            '& tr': { borderBottom: (theme) => `1px solid ${theme.palette.divider}` },
            '& tr:nth-of-type(even)': { backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08) },
            '& td': { color: 'text.primary', py: 0.5, px: 0.25 },
          }}
        >
          {props.children}
        </TableBody>
      </MuiTable>
    </TableContainer>
  );
};

export default Table;
