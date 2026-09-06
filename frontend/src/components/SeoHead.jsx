import { useEffect } from "react";

/**
 * SeoHead - Dynamic SEO title, meta tags, canonical link, and JSON-LD schema updater.
 */
export default function SeoHead({ title, description, keywords, canonical, jsonLd }) {
    useEffect(() => {
        if (title) {
            document.title = title;

            let ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) {
                ogTitle.content = title;
            }
        }

        if (description) {
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement("meta");
                metaDesc.name = "description";
                document.head.appendChild(metaDesc);
            }
            metaDesc.content = description;

            let ogDesc = document.querySelector('meta[property="og:description"]');
            if (ogDesc) {
                ogDesc.content = description;
            }
        }

        if (keywords) {
            let metaKeywords = document.querySelector('meta[name="keywords"]');
            if (!metaKeywords) {
                metaKeywords = document.createElement("meta");
                metaKeywords.name = "keywords";
                document.head.appendChild(metaKeywords);
            }
            metaKeywords.content = keywords;
        }

        if (canonical) {
            let canonicalLink = document.querySelector('link[rel="canonical"]');
            if (!canonicalLink) {
                canonicalLink = document.createElement("link");
                canonicalLink.rel = "canonical";
                document.head.appendChild(canonicalLink);
            }
            canonicalLink.href = canonical;
        }

        if (jsonLd) {
            let scriptTag = document.getElementById("page-jsonld-schema");
            if (!scriptTag) {
                scriptTag = document.createElement("script");
                scriptTag.id = "page-jsonld-schema";
                scriptTag.type = "application/ld+json";
                document.head.appendChild(scriptTag);
            }
            scriptTag.textContent = JSON.stringify(jsonLd);
        }

        return () => {
            const scriptTag = document.getElementById("page-jsonld-schema");
            if (scriptTag) {
                scriptTag.remove();
            }
        };
    }, [title, description, keywords, canonical, jsonLd]);

    return null;
}
