import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="card text-center">
      <h1 className="text-2xl font-medium">Page not found</h1>
      <p className="mb-5 mt-2 text-mu">That page doesn't exist or has moved.</p>
      <Link to="/" className="btn-primary">Back to dashboard</Link>
    </section>
  );
}
