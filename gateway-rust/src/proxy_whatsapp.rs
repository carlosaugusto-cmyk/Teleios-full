use axum::{
    extract::{State, Json},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::Value;
use crate::AppState;

pub async fn handle_send(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> Result<Response, StatusCode> {
    let url = format!("{}/send", state.whatsapp_service_url);
    
    let res = state.http_client.post(&url)
        .header("Authorization", format!("Bearer {}", state.auth_secret))
        .json(&payload)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();

    let response = axum::response::Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .unwrap();

    Ok(response)
}

pub async fn handle_qr(
    State(state): State<AppState>,
) -> Result<Response, StatusCode> {
    let url = format!("{}/qr", state.whatsapp_service_url);
    
    let res = state.http_client.get(&url)
        .header("Authorization", format!("Bearer {}", state.auth_secret))
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();

    let response = axum::response::Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .unwrap();

    Ok(response)
}
