import { API_GUIDES, guideCurl } from "@/lib/api-guides";

export function ApiGuides() {
  return (
    <div className="api-guides">
      {API_GUIDES.map((guide) => (
        <section className="card" id={`guide-${guide.slug}`} key={guide.slug}>
          <h2>{guide.title}</h2>
          <p>{guide.body}</p>
          {guide.examples.map((example) => (
            <div className="api-guide-example" key={example.operationId}>
              <h3>{example.title}</h3>
              <p>
                <span className="openapi-method" data-method={example.method}>
                  {example.method}
                </span>{" "}
                <code>{example.path}</code>{" "}
                <code>{example.operationId}</code>
              </p>
              <pre>
                <code>{guideCurl(example)}</code>
              </pre>
              {example.response ? (
                <pre>
                  <code>{example.response}</code>
                </pre>
              ) : null}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
