import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary Caught Error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.error("Failed to clear storage", e);
    }
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          backgroundColor: "#07090d",
          color: "#fff8e7",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: "24px",
          textAlign: "center"
        }}>
          <div style={{
            maxWidth: "540px",
            width: "100%",
            backgroundColor: "#15151a",
            border: "1px solid rgba(245, 185, 78, 0.3)",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.4)"
          }}>
            <div style={{
              fontSize: "48px",
              marginBottom: "16px"
            }}>⚠️</div>
            <h1 style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#f5b94e",
              margin: "0 0 12px 0"
            }}>Something went wrong</h1>
            <p style={{
              fontSize: "14px",
              color: "#b8ab91",
              margin: "0 0 24px 0",
              lineHeight: "1.6"
            }}>
              Tiffzy encountered an unexpected error. Tap reset below to refresh your session.
            </p>
            <div style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "12px",
              padding: "12px 16px",
              fontSize: "12px",
              fontFamily: "monospace",
              color: "#ef4444",
              textAlign: "left",
              overflowX: "auto",
              marginBottom: "24px"
            }}>
              {this.state.error?.toString() || "Unknown Error"}
            </div>
            <button
              onClick={this.handleReset}
              style={{
                backgroundColor: "#f5b94e",
                color: "#12100b",
                border: "none",
                borderRadius: "14px",
                padding: "12px 28px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "transform 0.2s"
              }}
            >
              Reset App & Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
