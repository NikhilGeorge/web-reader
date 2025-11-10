import requests
from newspaper import Article
from readability import Document
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Optional, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ArticleParser:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def parse(self, url: str) -> Dict:
        """Parse article from URL using multiple methods"""
        try:
            # Try newspaper3k first
            article_data = self._parse_with_newspaper(url)

            # If newspaper fails, try readability
            if not article_data.get('content'):
                article_data = self._parse_with_readability(url)

            return article_data
        except Exception as e:
            logger.error(f"Error parsing article {url}: {str(e)}")
            return {
                'url': url,
                'title': None,
                'content': None,
                'excerpt': None,
                'author': None,
                'published_date': None,
                'site_name': None
            }

    def _parse_with_newspaper(self, url: str) -> Dict:
        """Parse using newspaper3k library"""
        try:
            article = Article(url)
            article.download()
            article.parse()

            # Extract metadata
            excerpt = article.meta_description or (
                article.text[:300] + '...' if len(article.text) > 300 else article.text
            )

            return {
                'url': url,
                'title': article.title,
                'content': article.text,
                'excerpt': excerpt,
                'author': ', '.join(article.authors) if article.authors else None,
                'published_date': article.publish_date,
                'site_name': self._extract_site_name(url)
            }
        except Exception as e:
            logger.warning(f"Newspaper3k parsing failed for {url}: {str(e)}")
            return {}

    def _parse_with_readability(self, url: str) -> Dict:
        """Parse using readability-lxml as fallback"""
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()

            doc = Document(response.content)
            soup = BeautifulSoup(doc.summary(), 'html.parser')

            # Extract text content
            content = soup.get_text(separator='\n', strip=True)

            # Create excerpt
            excerpt = content[:300] + '...' if len(content) > 300 else content

            return {
                'url': url,
                'title': doc.title(),
                'content': content,
                'excerpt': excerpt,
                'author': None,
                'published_date': None,
                'site_name': self._extract_site_name(url)
            }
        except Exception as e:
            logger.warning(f"Readability parsing failed for {url}: {str(e)}")
            return {}

    def _extract_site_name(self, url: str) -> str:
        """Extract site name from URL"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc
            # Remove www. if present
            if domain.startswith('www.'):
                domain = domain[4:]
            return domain
        except:
            return None


# Singleton instance
article_parser = ArticleParser()
