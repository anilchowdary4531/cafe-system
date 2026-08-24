import React from "react";
import noConnectionImg from "../assets/no-connection.jpg";

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
            maxWidth: "480px",
            width: "100%",
            backgroundColor: "#15151a",
            border: "1px solid rgba(245, 185, 78, 0.3)",
            borderRadius: "28px",
            padding: "32px",
            boxShadow: "0 24px 80px rgba(0, 0, 0, 0.5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
          }}>
            <div style={{
              width: "220px",
              height: "220px",
              borderRadius: "24px",
              overflow: "hidden",
              marginBottom: "24px",
              boxShadow: "0 12px 32px rgba(0,0,0,0.3)"
            }}>
              <img 
                src={noConnectionImg} 
                alt="Connection Lost" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
              />
            </div>
            <h1 style={{
              fontSize: "22px",
              fontWeight: "bold",
              color: "#ffffff",
              margin: "0 0 8px 0"
            }}>Oops! Connection Lost</h1>
            <p style={{
              fontSize: "14px",
              color: "#a1a1aa",
              margin: "0 0 20px 0",
              lineHeight: "1.6"
            }}>
              Tiffzy lost connection to the server or encountered an error. Check your connection and tap reset below.
            </p>
            <div style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "12px",
              padding: "10px 14px",
              fontSize: "12px",
              fontFamily: "monospace",
              color: "#ef4444",
              textAlign: "left",
              width: "100%",
              overflowX: "auto",
              marginBottom: "20px",
              boxSizing: "border-box"
            }}>
              {this.state.error?.toString() || "Connection or Render Error"}
            </div>
            <button
              onClick={this.handleReset}
              style={{
                backgroundColor: "#f97316",
                color: "#ffffff",
                border: "none",
                borderRadius: "9999px",
                padding: "14px 32px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                width: "100%",
                boxShadow: "0 8px 24px rgba(249, 115, 22, 0.3)",
                transition: "transform 0.2s"
              }}
            >
              Reset App & Reconnect
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
