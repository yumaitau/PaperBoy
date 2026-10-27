use super::*;
use std::io::Read;
use std::net::TcpListener;
use std::thread;
use std::time::Duration;

#[test]
fn open_tracking_boolean_is_sent_in_patch_body() {
    for enabled in [true, false] {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}", listener.local_addr().unwrap());
        // Parse before starting the server so invalid arguments fail promptly.
        let cli = Cli::try_parse_from([
            "paperboy",
            "--api-key",
            "test-key",
            "--base-url",
            &endpoint,
            "open-tracking",
            "update",
            &enabled.to_string(),
        ])
        .unwrap();
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut headers = Vec::new();
            let mut byte = [0];
            while !headers.ends_with(b"\r\n\r\n") {
                stream.read_exact(&mut byte).unwrap();
                headers.push(byte[0]);
            }
            let headers = String::from_utf8(headers).unwrap();
            assert!(headers.starts_with("PATCH /api/v1/open-tracking HTTP/1.1\r\n"));
            let length: usize = headers
                .lines()
                .find_map(|line| {
                    let (name, value) = line.split_once(':')?;
                    name.eq_ignore_ascii_case("content-length")
                        .then(|| value.trim().parse().unwrap())
                })
                .unwrap();
            let mut body = vec![0; length];
            stream.read_exact(&mut body).unwrap();
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}")
                .unwrap();
            serde_json::from_slice::<Value>(&body).unwrap()
        });
        let client = PaperBoyClient::new(&cli.base_url, &cli.api_key).unwrap();
        dispatch(&client, cli.command).unwrap();
        assert_eq!(server.join().unwrap(), json!({"enabled": enabled}));
    }
}

#[test]
fn open_tracking_requires_a_boolean_value() {
    for value in [None, Some("yes")] {
        let mut args = vec![
            "paperboy",
            "--api-key",
            "test-key",
            "--base-url",
            "http://localhost:3000",
            "open-tracking",
            "update",
        ];
        if let Some(value) = value {
            args.push(value);
        }
        assert!(Cli::try_parse_from(args).is_err());
    }
}
