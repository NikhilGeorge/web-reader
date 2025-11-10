import requests
from readability import Document
from bs4 import BeautifulSoup
from datetime import datetime
from typing import Optional, Dict
import logging
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ArticleParser:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

    def parse(self, url: str) -> Dict:
        """Parse article from URL"""
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()

            # Parse with readability
            doc = Document(response.content)
            soup = BeautifulSoup(doc.summary(), 'html.parser')
            full_soup = BeautifulSoup(response.content, 'html.parser')

            # Extract text content
            content = soup.get_text(separator='\n', strip=True)

            # Create excerpt
            excerpt = content[:300] + '...' if len(content) > 300 else content

            # Try to extract author from meta tags
            author = self._extract_author(full_soup)

            # Try to extract published date
            published_date = self._extract_date(full_soup)

            return {
                'url': url,
                'title': doc.title(),
                'content': content,
                'excerpt': excerpt,
                'author': author,
                'published_date': published_date,
                'site_name': self._extract_site_name(url)
            }
        except Exception as e:
            logger.error(f"Error parsing article {url}: {str(e)}")
            return {
                'url': url,
                'title': None,
                'content': None,
                'excerpt': None,
                'author': None,
                'published_date': None,
                'site_name': self._extract_site_name(url)
            }

    def _extract_author(self, soup: BeautifulSoup) -> Optional[str]:
        """Try to extract author from meta tags"""
        try:
            # Try various meta tags for author
            author_selectors = [
                {'name': 'author'},
                {'property': 'article:author'},
                {'name': 'twitter:creator'},
                {'property': 'og:article:author'}
            ]

            for selector in author_selectors:
                tag = soup.find('meta', attrs=selector)
                if tag and tag.get('content'):
                    return tag.get('content')

            return None
        except:
            return None

    def _extract_date(self, soup: BeautifulSoup) -> Optional[datetime]:
        """Try to extract published date from meta tags"""
        try:
            # Try various meta tags for date
            date_selectors = [
                {'property': 'article:published_time'},
                {'name': 'publish_date'},
                {'property': 'og:published_time'},
                {'name': 'date'}
            ]

            for selector in date_selectors:
                tag = soup.find('meta', attrs=selector)
                if tag and tag.get('content'):
                    from dateutil import parser
                    return parser.parse(tag.get('content'))

            return None
        except:
            return None

    def _extract_site_name(self, url: str) -> str:
        """Extract site name from URL"""
        try:
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
