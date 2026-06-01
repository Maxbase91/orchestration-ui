import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    console.error('[RouteErrorBoundary]', error);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <AlertTriangle className="size-12 text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-sm text-center">{this.state.message}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={this.reset}>Try again</Button>
            <Button onClick={() => { this.reset(); window.location.href = '/'; }}>Go to Home</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
