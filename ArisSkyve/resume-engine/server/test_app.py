"""Run offline regression checks: python -m unittest discover -s server -p 'test_*.py'."""
import copy
import json
import socket
import unittest
from io import BytesIO
from unittest.mock import patch
from zipfile import ZIP_DEFLATED, ZipFile

import pymupdf as fitz
from docx import Document
from fastapi import HTTPException, UploadFile
from PIL import Image

import app


def extraction():
    return {
        'basics': {'name': 'Đặng Ánh', 'headline': 'Engineer', 'email': 'anh@example.com', 'phone': '',
                   'city': '', 'country': '', 'remoteStatus': '', 'summary': 'Builds reliable services.',
                   'avatarUrl': None, 'links': []},
        'work': [{'company': 'Acme', 'role': 'Engineer', 'startDate': '2020', 'endDate': '', 'isCurrent': False,
                  'highlights': ['Reduced latency by 20% using Redis.'], 'techStack': ['Redis'], 'metrics': []}],
        'projects': [{'title': 'API', 'tagline': 'Public data', 'description': 'Serves city data.', 'liveUrl': None,
                      'repoUrl': None, 'featured': False, 'stack': ['Python'], 'media': []}],
        'skills': [{'category': 'Backend', 'items': [{'name': 'Python', 'level': None, 'yearsOfExperience': None}]}],
        'education': [{'institution': 'University', 'degree': 'BSc', 'field': 'Computing', 'startDate': '2016',
                       'endDate': '', 'gpa': None, 'honors': ['Merit scholarship']}],
        'additionalSections': [{'heading': 'Certifications', 'content': 'Cloud certificate, 2022'}],
    }


def model_response(value):
    return {'status': 'completed', 'output': [{'type': 'message', 'content': [
        {'type': 'output_text', 'text': json.dumps(value)}]}]}


class NormalizationTests(unittest.TestCase):
    def test_all_months_remain_correct(self):
        for month in range(1, 13):
            with self.subTest(month=month):
                self.assertEqual(app.date(f'2024-{month:02d}'), f'2024-{month:02d}')
                self.assertEqual(app.date(f'2024/{month}'), f'2024-{month:02d}')

    def test_partial_dates_do_not_gain_invented_months(self):
        for source in ['', '2020', 'Spring 2020', '2024-13', '2024-110']:
            self.assertEqual(app.date(source), source)
        self.assertEqual(app.date('2024-12-31'), '2024-12')

    def test_missing_dates_preserve_work_education_and_facts(self):
        raw = extraction()
        raw['work'][0]['startDate'] = ''
        notices = []
        result = app.normalize(raw, notices)
        self.assertEqual(len(result['work']), 1)
        self.assertEqual(len(result['education']), 1)
        self.assertEqual(result['work'][0]['highlights'], raw['work'][0]['highlights'])
        self.assertEqual(result['education'][0]['honors'], ['Merit scholarship'])
        self.assertEqual(result['education'][0]['startDate'], '2016')
        self.assertEqual(result['education'][0]['endDate'], '')
        self.assertEqual(result['work'][0]['endDate'], '')
        self.assertFalse(result['work'][0]['isCurrent'])
        self.assertGreaterEqual(len(notices), 2)
        app.validate_canonical(result)

    def test_null_is_current_only_when_explicit(self):
        raw = extraction()
        raw['work'][0]['endDate'] = None
        self.assertFalse(app.normalize(raw)['work'][0]['isCurrent'])
        self.assertEqual(app.normalize(raw)['work'][0]['endDate'], '')
        raw['work'][0]['isCurrent'] = True
        self.assertTrue(app.normalize(raw)['work'][0]['isCurrent'])
        self.assertIsNone(app.normalize(raw)['work'][0]['endDate'])

    def test_custom_sections_and_vietnamese_slug_survive(self):
        result = app.normalize(extraction())
        self.assertEqual(result['meta']['slug'], 'dang-anh')
        self.assertEqual(result['customSections'][0]['content'], 'Cloud certificate, 2022')
        self.assertEqual(result['skills'][0]['items'], [{'name': 'Python'}])

    def test_invalid_email_is_rejected_by_generated_contract(self):
        result = app.normalize(extraction())
        result['basics']['email'] = 'invalid-email'
        with self.assertRaises(HTTPException) as failure:
            app.validate_canonical(result)
        self.assertEqual(failure.exception.status_code, 422)
        self.assertIn('basics.email', failure.exception.detail)

    def test_source_urls_are_validated_and_flagged(self):
        raw = extraction()
        raw['projects'][0]['liveUrl'] = 'javascript:alert(1)'
        raw['projects'][0]['repoUrl'] = 'https://github.com/example/repo'
        notices = []
        result = app.normalize(raw, notices)
        self.assertNotIn('liveUrl', result['projects'][0])
        self.assertEqual(result['projects'][0]['repoUrl'], raw['projects'][0]['repoUrl'])
        self.assertTrue(any('javascript:alert(1)' in notice for notice in notices))
        for value in ['http://', 'https://[broken', 'https://a.com:wrong', 'https://bad host.com', None]:
            self.assertFalse(app.valid_url(value))


class ExtractionTests(unittest.TestCase):
    def test_enormous_pdf_page_renders_with_bounded_dimensions(self):
        with fitz.open() as document:
            document.new_page(width=100000, height=100000)
            raw = document.tobytes()
        _, images = app.extract(raw, '.pdf')
        with Image.open(BytesIO(images[0][1])) as image:
            self.assertLessEqual(image.width * image.height, app.MAX_PDF_PIXELS)
            self.assertLessEqual(max(image.size), 2048)

    def test_pdf_page_limit_precedes_rendering(self):
        with fitz.open() as document:
            for _ in range(app.MAX_PAGES + 1):
                document.new_page()
            raw = document.tobytes()
        with self.assertRaises(HTTPException) as failure:
            app.extract(raw, '.pdf')
        self.assertEqual(failure.exception.status_code, 413)

    def test_encrypted_pdf_is_rejected(self):
        with fitz.open() as document:
            document.new_page()
            raw = document.tobytes(encryption=fitz.PDF_ENCRYPT_AES_256, owner_pw='owner', user_pw='secret')
        with self.assertRaises(HTTPException) as failure:
            app.extract(raw, '.pdf')
        self.assertEqual(failure.exception.status_code, 422)

    def test_docx_expansion_limit_precedes_document_parsing(self):
        buffer = BytesIO()
        with ZipFile(buffer, 'w', compression=ZIP_DEFLATED) as archive:
            archive.writestr('word/document.xml', b'x' * 101)
        with patch.object(app, 'MAX_DOCX_EXPANSION', 100), patch.object(app, 'Document') as document:
            with self.assertRaises(HTTPException) as failure:
                app.extract(buffer.getvalue(), '.docx')
            self.assertEqual(failure.exception.status_code, 413)
            document.assert_not_called()

    def test_docx_includes_header_contacts_and_table_entries(self):
        document = Document()
        document.sections[0].header.paragraphs[0].text = 'contact@example.com'
        document.add_paragraph('Professional history')
        table = document.add_table(rows=1, cols=2)
        table.cell(0, 0).text = 'Acme'
        table.cell(0, 1).text = 'Engineer'
        buffer = BytesIO()
        document.save(buffer)
        text, images = app.extract(buffer.getvalue(), '.docx')
        self.assertIn('contact@example.com', text)
        self.assertIn('Acme | Engineer', text)
        self.assertEqual(images, [])

    def test_invalid_image_and_invalid_text_fail_without_model(self):
        for raw, ext in [(b'not an image', '.png'), (b'\xff\xfe\x00', '.txt'), (b'not a zip', '.docx')]:
            with self.subTest(ext=ext), self.assertRaises(HTTPException) as failure:
                app.extract(raw, ext)
            self.assertEqual(failure.exception.status_code, 422)

    def test_image_dimensions_checked_before_decode(self):
        buffer = BytesIO()
        Image.new('RGB', (20, 20)).save(buffer, format='PNG')
        with patch.object(app, 'MAX_IMAGE_PIXELS', 100), self.assertRaises(HTTPException) as failure:
            app.extract(buffer.getvalue(), '.png')
        self.assertEqual(failure.exception.status_code, 413)


class ModelAndEndpointTests(unittest.TestCase):
    def call_with_response(self, response):
        with patch.dict(app.os.environ, {'OPENAI_API_KEY': 'offline-test-key'}), \
                patch.object(app.urllib.request, 'urlopen', return_value=BytesIO(json.dumps(response).encode())):
            return app.call_model('test document', [])

    def test_structured_output_validated_before_normalizing(self):
        self.assertEqual(self.call_with_response(model_response(extraction())), extraction())
        with self.assertRaises(HTTPException) as failure:
            self.call_with_response(model_response({'basics': {}}))
        self.assertEqual(failure.exception.status_code, 502)

    def test_refusals_and_incomplete_responses_are_errors(self):
        cases = [({'status': 'incomplete', 'output': []}, 502),
                 ({'status': 'completed', 'output': [{'content': [{'type': 'refusal', 'refusal': 'Cannot comply'}]}]}, 422)]
        for response, code in cases:
            with self.subTest(code=code), self.assertRaises(HTTPException) as failure:
                self.call_with_response(response)
            self.assertEqual(failure.exception.status_code, code)

    def test_network_timeout_returns_gateway_timeout(self):
        with patch.dict(app.os.environ, {'OPENAI_API_KEY': 'offline-test-key'}), \
                patch.object(app.urllib.request, 'urlopen', side_effect=socket.timeout()), \
                self.assertRaises(HTTPException) as failure:
            app.call_model('test document', [])
        self.assertEqual(failure.exception.status_code, 504)

    def test_endpoint_closes_upload_and_returns_canonical_data_with_warnings(self):
        upload = UploadFile(file=BytesIO(b'Resume source'), filename='resume.txt')
        with patch.object(app, 'call_model', return_value=copy.deepcopy(extraction())):
            response = app.parse(upload)
        result = json.loads(response.body)
        app.validate_canonical(result['data'])
        self.assertEqual(len(result['data']['work']), 1)
        self.assertTrue(result['warnings'])
        self.assertTrue(upload.file.closed)

    def test_busy_service_does_not_start_another_model_job(self):
        upload = UploadFile(file=BytesIO(b'Resume source'), filename='resume.txt')
        with patch.object(app, 'PARSE_SLOTS') as slots, patch.object(app, 'call_model') as model:
            slots.acquire.return_value = False
            with self.assertRaises(HTTPException) as failure:
                app.parse(upload)
            self.assertEqual(failure.exception.status_code, 429)
            self.assertTrue(upload.file.closed)
            model.assert_not_called()


if __name__ == '__main__':
    unittest.main()
