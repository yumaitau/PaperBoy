use std::io::{Read, Write};
use std::net::TcpListener;
use std::process::Command;
use std::thread;
use std::time::Duration;

fn request(response: &'static [u8]) -> std::process::Output {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let server = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut request = Vec::new();
        let mut byte = [0];
        while !request.ends_with(b"\r\n\r\n") {
            stream.read_exact(&mut byte).unwrap();
            request.push(byte[0]);
        }
        stream.write_all(response).unwrap();
    });
    let output = Command::new(env!("CARGO_BIN_EXE_paperboy"))
        .args([
            "--api-key",
            "test-key",
            "--base-url",
            &format!("http://{address}"),
            "api",
            "GET",
            "/test",
        ])
        .output()
        .unwrap();
    server.join().unwrap();
    output
}

#[test]
fn incomplete_success_body_exits_with_error() {
    let output =
        request(b"HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\n{\"id\":");
    assert!(!output.status.success(), "unexpected success: {output:?}");
    assert!(
        output.stdout.is_empty(),
        "printed a synthetic success response"
    );
    assert!(
        String::from_utf8_lossy(&output.stderr).contains("Could not read PaperBoy response body")
    );
}

#[test]
fn genuinely_empty_success_body_remains_successful() {
    let output = request(b"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n");
    assert!(output.status.success(), "{output:?}");
    let value: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value, serde_json::json!({"ok": true, "status": 204}));
}
