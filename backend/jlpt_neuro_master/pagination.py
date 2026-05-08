from rest_framework.pagination import PageNumberPagination


class FlexPageNumberPagination(PageNumberPagination):
    """Default pagination that allows clients to request up to 2000 items per page."""
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 2000
