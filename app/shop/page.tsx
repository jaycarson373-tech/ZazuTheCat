import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Shop Tesllamas | Coming Soon", description: "The Tesllama model shop is coming soon." };

const products = [
  { name: "TESLLAMA S", image: "/tesllama-s.jpg" },
  { name: "TESLLAMA X", image: "/tesllama-x.jpg" },
  { name: "TESLLAMA CT", image: "/tesllama-ct.jpg" },
];

export default function ShopPage() {
  return (
    <main className="shop-page">
      <header className="shop-header"><Link href="/">TESLLAMA</Link><span>SHOP</span></header>
      <div className="shop-preview" aria-hidden="true">
        {products.map((product) => (
          <article key={product.name}>
            <div><Image src={product.image} alt="" fill sizes="33vw" /></div>
            <span>{product.name}</span><strong>Reserved</strong>
          </article>
        ))}
      </div>
      <div className="shop-fade" />
      <section className="shop-message">
        <p>SHOP TESLLAMAS</p>
        <h1>COMING SOON</h1>
        <span>The first model collection is being prepared.</span>
        <Link href="/">Return home</Link>
      </section>
    </main>
  );
}
