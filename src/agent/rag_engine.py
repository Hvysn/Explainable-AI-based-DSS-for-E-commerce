"""
Enterprise Domain RAG (Retrieval-Augmented Generation) Engine
Indexes warehouse Standard Operating Procedures (SOPs), Quality Control standards,
and carrier SLA guidelines for real-time semantic retrieval during order packing.
"""

import os
import re
from typing import List, Dict, Any
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB_DIR = os.path.join(BASE_DIR, "data", "knowledge_base")


class WarehouseRAGEngine:
    def __init__(self, kb_dir: str = KB_DIR):
        self.kb_dir = kb_dir
        self.chunks: List[Dict[str, Any]] = []
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words='english',
            token_pattern=r'(?u)\b\w+\b'
        )
        self.tfidf_matrix = None
        self._load_and_index_documents()

    def _load_and_index_documents(self):
        """Loads and chunks all markdown files from the knowledge base."""
        if not os.path.exists(self.kb_dir):
            os.makedirs(self.kb_dir, exist_ok=True)
            return

        documents = []
        for filename in sorted(os.listdir(self.kb_dir)):
            if filename.endswith(".md"):
                file_path = os.path.join(self.kb_dir, filename)
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                doc_title = filename.replace(".md", "").replace("_", " ").title()
                # Extract Document ID if present
                doc_id_match = re.search(r'\*\*Document ID:\*\*\s*([^\n]+)', content)
                doc_id = doc_id_match.group(1).strip() if doc_id_match else filename

                # Split by markdown H2 sections (## )
                sections = re.split(r'\n(?=##\s+)', content)
                for sec_idx, section in enumerate(sections):
                    clean_sec = section.strip()
                    if not clean_sec:
                        continue
                    
                    # Extract section heading
                    lines = clean_sec.split('\n')
                    first_line = lines[0].strip()
                    heading = first_line.replace('#', '').strip() if first_line.startswith('#') else f"General ({doc_title})"
                    
                    chunk_entry = {
                        "chunk_id": f"{filename}#sec_{sec_idx}",
                        "doc_title": doc_title,
                        "doc_id": doc_id,
                        "section_heading": heading,
                        "text": clean_sec,
                        "citation": f"[{doc_id} § {heading}]"
                    }
                    self.chunks.append(chunk_entry)
                    documents.append(clean_sec)

        if documents:
            self.tfidf_matrix = self.vectorizer.fit_transform(documents)

    def search(self, query: str, top_k: int = 2) -> List[Dict[str, Any]]:
        """
        Performs semantic vector search over the warehouse knowledge base.
        Returns top-K relevant SOP chunks with similarity scores and citations.
        """
        if not self.chunks or self.tfidf_matrix is None:
            return []

        query_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix)[0]

        top_indices = np.argsort(similarities)[::-1][:top_k]
        results = []

        for idx in top_indices:
            score = float(similarities[idx])
            # Only return chunks with positive relevance
            if score > 0.05:
                chunk = self.chunks[idx].copy()
                chunk["relevance_score"] = round(score, 4)
                results.append(chunk)

        return results


# Global singleton instance for high-speed reuse across API requests
rag_engine = WarehouseRAGEngine()
