const axios = require('axios');
const { expect } = require('chai');

jest.mock('axios');
jest.mock('fs');
jest.mock('path');
const mockedAxios = axios;

// Mock hexo object
global.hexo = {
  extend: {
    tag: {
      register: jest.fn()
    },
    filter: {
      register: jest.fn()
    }
  },
  log: {
    debug: jest.fn(),
    error: jest.fn()
  },
  config: {}
};

describe('hexo-github-card-inline', () => {
  let tagFunction;

  beforeAll(() => {
    require('../index');
    tagFunction = hexo.extend.tag.register.mock.calls[0][1];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('user card', () => {
    it('should render user card with language statistics', async () => {
      const mockUser = {
        login: 'neoalienson',
        name: 'Neo Alienson',
        avatar_url: 'https://github.com/avatar.jpg',
        html_url: 'https://github.com/neoalienson',
        bio: 'Developer',
        followers: 100,
        public_repos: 25
      };

      const mockRepos = [
        { language: 'JavaScript', stargazers_count: 5 },
        { language: 'JavaScript', stargazers_count: 3 },
        { language: 'Python', stargazers_count: 2 },
        { language: 'TypeScript', stargazers_count: 1 },
        { language: null, stargazers_count: 0 }
      ];

      const mockEvents = [
        { type: 'PushEvent', created_at: new Date().toISOString() },
        { type: 'PullRequestEvent', created_at: new Date().toISOString() }
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockUser })
        .mockResolvedValueOnce({ data: mockRepos })
        .mockResolvedValueOnce({ data: mockEvents });

      const result = await tagFunction(['user:neoalienson']);
      
      expect(result).to.include('github-card');
      expect(result).to.include('Neo Alienson');
      expect(result).to.include('Developer');
      expect(result).to.include('👥 100');
      expect(result).to.include('github-card-languages');
      expect(result).to.include('JavaScript');
      expect(result).to.include('50.0%');
      expect(result).to.include('Python');
      expect(result).to.include('25.0%');
      expect(result).to.include('github-card-language-bar');
      expect(result).to.include('#f1e05a');
    });

    it('should handle "Other" languages when more than 5', async () => {
      const mockUser = {
        login: 'testuser',
        name: 'Test User',
        avatar_url: 'https://github.com/avatar.jpg',
        html_url: 'https://github.com/testuser',
        followers: 50,
        public_repos: 10
      };

      const mockRepos = [
        { language: 'JavaScript', stargazers_count: 1 },
        { language: 'Python', stargazers_count: 1 },
        { language: 'Java', stargazers_count: 1 },
        { language: 'Go', stargazers_count: 1 },
        { language: 'Rust', stargazers_count: 1 },
        { language: 'C++', stargazers_count: 1 },
        { language: 'Ruby', stargazers_count: 1 }
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockUser })
        .mockResolvedValueOnce({ data: mockRepos })
        .mockResolvedValueOnce({ data: [] });

      const result = await tagFunction(['user:testuser']);
      
      expect(result).to.include('Other');
      expect(result).to.include('28.6%');
      expect(result).to.include('#cccccc');
    });
  });

  describe('repo card', () => {
    it('should render repo card', async () => {
      const mockRepo = {
        full_name: 'neoalienson/test-repo',
        html_url: 'https://github.com/neoalienson/test-repo',
        description: 'Test repository',
        stargazers_count: 10,
        forks_count: 5,
        language: 'JavaScript'
      };

      mockedAxios.get.mockResolvedValue({ data: mockRepo });

      const result = await tagFunction(['user:neoalienson', 'repo:test-repo']);
      
      expect(result).to.include('github-card');
      expect(result).to.include('neoalienson/test-repo');
      expect(result).to.include('Test repository');
      expect(result).to.include('⭐ 10');
      expect(result).to.include('Language: JavaScript');
    });
  });

  describe('error handling', () => {
    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      const result = await tagFunction(['user:invalid']);
      
      expect(result).to.include('github-card-error');
      expect(result).to.include('Error loading GitHub data');
    });

    it('should handle invalid arguments', async () => {
      const result = await tagFunction([]);
      expect(result).to.equal('');
    });

    it('should use default language color for unknown languages', async () => {
      const mockUser = {
        login: 'testuser',
        avatar_url: 'https://github.com/avatar.jpg',
        html_url: 'https://github.com/testuser',
        followers: 10,
        public_repos: 1
      };

      const mockRepos = [{ language: 'UnknownLang', stargazers_count: 1 }];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockUser })
        .mockResolvedValueOnce({ data: mockRepos })
        .mockResolvedValueOnce({ data: [] });

      const result = await tagFunction(['user:testuser']);
      
      expect(result).to.include('UnknownLang');
      expect(result).to.include('#8cc8ff');
    });
  });
});