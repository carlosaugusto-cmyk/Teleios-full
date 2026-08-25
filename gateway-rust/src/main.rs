use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Router,
};
use reqwest::Client;
use std::sync::Arc;
use tokio::net::TcpListener;

mod middleware_auth;
mod proxy_whatsapp;

#[derive(Clone)]
pub struct AppState {
    pub http_client: Client,
    pub auth_secret: String,
    pub whatsapp_service_url: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let auth_secret = std::env::var("RUST_GATEWAY_SECRET")
        .unwrap_or_else(|_| "dev_rust_secret_12345".to_string());
    let whatsapp_url = std::env::var("WHATSAPP_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8080".to_string());

    let state = AppState {
        http_client: Client::new(),
        auth_secret,
        whatsapp_service_url: whatsapp_url,
    };

    let app = Router::new()
        .route("/health", get(|| async { "Gateway OK" }))
        .route("/send", post(proxy_whatsapp::handle_send))
        .route("/qr", get(proxy_whatsapp::handle_qr))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            middleware_auth::require_auth,
        ))
        .with_state(state);

    let listener = TcpListener::bind("0.0.0.0:8000").await.unwrap();
    println!("Rust Gateway rodando em http://0.0.0.0:8000");
    axum::serve(listener, app).await.unwrap();
}
