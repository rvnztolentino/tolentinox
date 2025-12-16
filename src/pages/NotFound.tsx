import { Link } from 'react-router-dom';
import { ArrowRight } from "lucide-react";

export default function NotFound() {
    return (
        <main className="flex-1 flex items-center justify-center bg-white text-black/90 font-inter py-24 md:py-32 lg:py-18 xl:py-40">
        <div className="container px-8 md:px-6 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-black/95 tracking-tighter">
                404 - Page Not Found
            </h1>
            <p className="max-w-[600px] mx-auto text-black/50 md:text-md mt-4 text-center">
                Oops! The page you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link
                to="/"
                className="text-black/50 text-sm inline-flex items-center gap-2 hover:bg-black/10 rounded-md px-2 py-1 mt-4 mb-6 transition-colors"
            >
            Go Back Home
                <ArrowRight className="h-4 w-4" />
            </Link>
        </div>
        </main>
    )
}