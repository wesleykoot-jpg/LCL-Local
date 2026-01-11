import { Navigate } from 'react-router-dom';

// Redirect to feed - kept for backwards compatibility
const Index = () => {
  return <Navigate to="/feed" replace />;
};

export default Index;
