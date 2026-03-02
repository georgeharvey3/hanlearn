import React, { Component, ErrorInfo, ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI to render on error. */
  fallback?: ReactNode;
  /** Called when an error is caught — use for external logging. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic React error boundary.
 *
 * Catches render-time errors in its subtree and shows a recoverable
 * fallback UI instead of crashing the entire application.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          p: 3,
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" gutterBottom>
          Something went wrong
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 360 }}>
          An unexpected error occurred. You can try again or go back to the home page.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={this.handleRetry}>
            Try Again
          </Button>
          <Button variant="outlined" href="/">
            Home
          </Button>
        </Box>
      </Box>
    );
  }
}

export default ErrorBoundary;
