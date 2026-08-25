use axum::{
    extract::{Request, State},
    http::{StatusCode, header},
    middleware::Next,
    response::Response,
};
use crate::AppState;

pub async fn require_auth(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Permitir rota health ser pública
    if req.uri().path() == "/health" {
        return Ok(next.run(req).await);
    }

    let auth_header = req.headers().get(header::AUTHORIZATION);
    
    let bearer = match auth_header {
        Some(h) => h.to_str().unwrap_or(""),
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let expected = format!("Bearer {}", state.auth_secret);
    if bearer != expected {
        return Err(StatusCode::UNAUTHORIZED);
    }

    Ok(next.run(req).await)
}
