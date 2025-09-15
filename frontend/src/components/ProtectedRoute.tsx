import { Navigate } from "react-router-dom";
import { useSession } from "@/contexts/SessionContext";
import LoadingSpinner from "@/components/common/LoadingSpinner";

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useSession();

  // Always show loading until session validation is complete
  if (isLoading) {
    return (
      <LoadingSpinner 
        message="Checking your session..." 
        showTips={true}
      />
    );
  }

  // Only render children if user is authenticated AND not loading
  if (!isAuthenticated) {
    return (
      <Navigate 
        to="/" 
        replace 
        state={{ fromProtectedRoute: true }}
      />
    );
  }

  return children;
};

export default ProtectedRoute;
