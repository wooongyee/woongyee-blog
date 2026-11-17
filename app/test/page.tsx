/**
 * Notion 연결 테스트 페이지
 * /test 경로로 접속하여 Notion 데이터베이스 연결 확인
 */

import { notFound } from 'next/navigation';
import { getPublishedPosts, getDataSourceId } from '@/lib/notion';
import { blogConfig } from '@/blog.config';

export default async function TestPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  let posts;
  let dataSourceId;
  let error: string | null = null;

  try {
    // Data Source ID 조회
    dataSourceId = await getDataSourceId();

    // 포스트 목록 가져오기
    posts = await getPublishedPosts({ limit: 5 });
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
    console.error('Notion 연결 오류:', err);
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>🧪 Notion 연결 테스트</h1>

      {/* 설정 정보 */}
      <section style={{ marginBottom: '2rem', padding: '1rem', background: '#f3f4f6', borderRadius: '0.5rem' }}>
        <h2>📋 설정 정보</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li><strong>블로그 이름:</strong> {blogConfig.blog.name}</li>
          <li><strong>작성자:</strong> {blogConfig.author.name}</li>
          <li><strong>Database ID:</strong> {blogConfig.notion.databaseId}</li>
          <li><strong>Data Source ID:</strong> {dataSourceId || 'N/A'}</li>
        </ul>
      </section>

      {/* 에러 표시 */}
      {error && (
        <section style={{
          marginBottom: '2rem',
          padding: '1rem',
          background: '#fee',
          borderRadius: '0.5rem',
          border: '1px solid #fcc'
        }}>
          <h2 style={{ color: '#c00' }}>❌ 연결 실패</h2>
          <p><strong>에러:</strong> {error}</p>
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>해결 방법</summary>
            <ol style={{ marginTop: '0.5rem' }}>
              <li>.env.local 파일에 NOTION_API_KEY와 NOTION_DATABASE_ID가 올바르게 설정되어 있는지 확인하세요.</li>
              <li>Notion Integration이 해당 데이터베이스에 접근 권한이 있는지 확인하세요.</li>
              <li>데이터베이스에 &quot;Status&quot; 속성이 있고, &quot;Published&quot; 값을 가진 페이지가 있는지 확인하세요.</li>
            </ol>
          </details>
        </section>
      )}

      {/* 포스트 목록 */}
      {!error && posts && (
        <section>
          <h2>📝 포스트 목록 ({posts.length}개)</h2>

          {posts.length === 0 ? (
            <p style={{ padding: '1rem', background: '#fffbeb', borderRadius: '0.5rem' }}>
              ⚠️ 발행된 포스트가 없습니다. Notion 데이터베이스에서 Status를 &quot;Published&quot;로 설정해주세요.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {posts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    background: 'white'
                  }}
                >
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>{post.title}</h3>
                  <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                    {post.excerpt || '요약 없음'}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: '#dbeafe',
                          color: '#1e40af',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#9ca3af' }}>
                    <strong>Slug:</strong> {post.slug} |
                    <strong> 발행일:</strong> {new Date(post.publishDate).toLocaleDateString('ko-KR')} |
                    <strong> ID:</strong> {post.id.slice(0, 8)}...
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 성공 메시지 */}
      {!error && posts && posts.length > 0 && (
        <section style={{
          marginTop: '2rem',
          padding: '1rem',
          background: '#d1fae5',
          borderRadius: '0.5rem',
          border: '1px solid #a7f3d0'
        }}>
          <p style={{ margin: 0, color: '#065f46', fontWeight: 'bold' }}>
            ✅ Notion 연결 성공! API가 정상적으로 작동하고 있습니다.
          </p>
        </section>
      )}
    </div>
  );
}
