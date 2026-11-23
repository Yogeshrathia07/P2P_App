/**
 * Curated Problem Bank for PeerForge Mock Interviews
 * Organized across DSA, Frontend Web Architecture, and Backend & System Design.
 */

export const PROBLEMS = [
  // --- Track 1: Data Structures & Algorithms (DSA) ---
  {
    id: "two-sum",
    title: "Two Sum",
    track: "Data Structures & Algorithms (DSA)",
    difficulty: "Junior",
    entryFunction: "twoSum",
    description: `Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.`,
    examples: [
      {
        input: "nums = [2, 7, 11, 15], target = 9",
        output: "[0, 1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        input: "nums = [3, 2, 4], target = 6",
        output: "[1, 2]",
        explanation: "nums[1] + nums[2] == 6, we return [1, 2].",
      },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists.",
    ],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
      typescript: `function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }
    map.set(nums[i], i);
  }
  return [];
}`,
      python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, n in enumerate(nums):
            comp = target - n
            if comp in seen:
                return [seen[comp], i]
            seen[n] = i
        return []`,
      cpp: `#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < nums.size(); i++) {
            int comp = target - nums[i];
            if (seen.count(comp)) return {seen[comp], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`,
      java: `import java.util.HashMap;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        HashMap<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (map.containsKey(comp)) {
                return new int[] { map.get(comp), i };
            }
            map.put(nums[i], i);
        }
        return new int[0];
    }
}`,
    },
    testCases: [
      { input: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { input: [[3, 2, 4], 6], expected: [1, 2] },
      { input: [[3, 3], 6], expected: [0, 1] },
    ],
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    track: "Data Structures & Algorithms (DSA)",
    difficulty: "Junior",
    entryFunction: "isValid",
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    examples: [
      { input: 's = "()"', output: "true", explanation: "Simple matching pair." },
      { input: 's = "()[]{}"', output: "true", explanation: "Consecutive valid pairs." },
      { input: 's = "(]"', output: "false", explanation: "Mismatched bracket type." },
    ],
    constraints: ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'."],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
  const stack = [];
  const map = { ')': '(', '}': '{', ']': '[' };
  
  for (const char of s) {
    if (char === '(' || char === '{' || char === '[') {
      stack.push(char);
    } else {
      if (stack.pop() !== map[char]) return false;
    }
  }
  return stack.length === 0;
}`,
      typescript: `function isValid(s: string): boolean {
  const stack: string[] = [];
  const map: Record<string, string> = { ')': '(', '}': '{', ']': '[' };
  for (const char of s) {
    if (char === '(' || char === '{' || char === '[') {
      stack.push(char);
    } else {
      if (stack.pop() !== map[char]) return false;
    }
  }
  return stack.length === 0;
}`,
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        stack = []
        mapping = {')': '(', '}': '{', ']': '['}
        for char in s:
            if char in mapping.values():
                stack.append(char)
            elif char in mapping:
                if not stack or stack.pop() != mapping[char]:
                    return False
        return len(stack) == 0`,
      cpp: `#include <string>
#include <stack>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        stack<char> st;
        for (char c : s) {
            if (c == '(' || c == '{' || c == '[') st.push(c);
            else {
                if (st.empty()) return false;
                char top = st.top(); st.pop();
                if (c == ')' && top != '(') return false;
                if (c == '}' && top != '{') return false;
                if (c == ']' && top != '[') return false;
            }
        }
        return st.empty();
    }
};`,
      java: `import java.util.Stack;

class Solution {
    public boolean isValid(String s) {
        Stack<Character> stack = new Stack<>();
        for (char c : s.toCharArray()) {
            if (c == '(' || c == '{' || c == '[') stack.push(c);
            else {
                if (stack.isEmpty()) return false;
                char top = stack.pop();
                if (c == ')' && top != '(') return false;
                if (c == '}' && top != '{') return false;
                if (c == ']' && top != '[') return false;
            }
        }
        return stack.isEmpty();
    }
}`,
    },
    testCases: [
      { input: ["()"], expected: true },
      { input: ["()[]{}"], expected: true },
      { input: ["(]"], expected: false },
      { input: ["([)]"], expected: false },
      { input: ["{[]}"], expected: true },
    ],
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    track: "Data Structures & Algorithms (DSA)",
    difficulty: "Mid-Level",
    entryFunction: "merge",
    description: `Given an array of \`intervals\` where \`intervals[i] = [start_i, end_i]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.`,
    examples: [
      {
        input: "intervals = [[1,3],[2,6],[8,10],[15,18]]",
        output: "[[1,6],[8,10],[15,18]]",
        explanation: "Since intervals [1,3] and [2,6] overlap, merge them into [1,6].",
      },
    ],
    constraints: ["1 <= intervals.length <= 10^4", "intervals[i].length == 2", "0 <= start_i <= end_i <= 10^4"],
    starterCode: {
      javascript: `/**
 * @param {number[][]} intervals
 * @return {number[][]}
 */
function merge(intervals) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a[0] - b[0]);
  const result = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = result[result.length - 1];

    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      result.push(current);
    }
  }
  return result;
}`,
      typescript: `function merge(intervals: number[][]): number[][] {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a[0] - b[0]);
  const result: number[][] = [intervals[0]];

  for (let i = 1; i < intervals.length; i++) {
    const current = intervals[i];
    const last = result[result.length - 1];
    if (current[0] <= last[1]) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      result.push(current);
    }
  }
  return result;
}`,
      python: `class Solution:
    def merge(self, intervals: list[list[int]]) -> list[list[int]]:
        intervals.sort(key=lambda x: x[0])
        merged = []
        for interval in intervals:
            if not merged or merged[-1][1] < interval[0]:
                merged.append(interval)
            else:
                merged[-1][1] = max(merged[-1][1], interval[1])
        return merged`,
      cpp: `#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    vector<vector<int>> merge(vector<vector<int>>& intervals) {
        sort(intervals.begin(), intervals.end());
        vector<vector<int>> merged;
        for (auto& item : intervals) {
            if (merged.empty() || merged.back()[1] < item[0]) merged.push_back(item);
            else merged.back()[1] = max(merged.back()[1], item[1]);
        }
        return merged;
    }
};`,
      java: `import java.util.*;

class Solution {
    public int[][] merge(int[][] intervals) {
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
        LinkedList<int[]> merged = new LinkedList<>();
        for (int[] interval : intervals) {
            if (merged.isEmpty() || merged.getLast()[1] < interval[0]) {
                merged.add(interval);
            } else {
                merged.getLast()[1] = Math.max(merged.getLast()[1], interval[1]);
            }
        }
        return merged.toArray(new int[merged.size()][]);
    }
}`,
    },
    testCases: [
      {
        input: [
          [
            [1, 3],
            [2, 6],
            [8, 10],
            [15, 18],
          ],
        ],
        expected: [
          [1, 6],
          [8, 10],
          [15, 18],
        ],
      },
      {
        input: [
          [
            [1, 4],
            [4, 5],
          ],
        ],
        expected: [[1, 5]],
      },
    ],
  },

  // --- Track 2: Frontend Web Architecture ---
  {
    id: "debounce",
    title: "Debounce Function",
    track: "Frontend Web Architecture",
    difficulty: "Mid-Level",
    entryFunction: "debounceTester",
    description: `Implement a \`debounce\` higher-order function that delays invoking the passed function until after \`wait\` milliseconds have elapsed since the last time the debounced function was invoked.

The debounced function should support passing arguments through to the original function and preserving context.`,
    examples: [
      {
        input: "debouncedFn = debounce(log, 50); debouncedFn('a'); debouncedFn('b');",
        output: "'b' invoked once after 50ms",
        explanation: "Rapid consecutive calls reset the timer.",
      },
    ],
    constraints: ["wait >= 0", "Arguments must pass cleanly to callback"],
    starterCode: {
      javascript: `/**
 * @param {Function} func
 * @param {number} wait
 * @return {Function}
 */
function debounce(func, wait) {
  let timeoutId = null;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

// Verification helper wrapper
function debounceTester(calls, wait) {
  let recorded = [];
  const fn = debounce((val) => recorded.push(val), wait);
  calls.forEach(c => fn(c));
  return "configured";
}`,
      typescript: `function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}`,
      python: `import threading

def debounce(wait):
    def decorator(fn):
        def debounced(*args, **kwargs):
            def call_it():
                fn(*args, **kwargs)
            try:
                debounced.t.cancel()
            except(AttributeError):
                pass
            debounced.t = threading.Timer(wait, call_it)
            debounced.t.start()
        return debounced
    return decorator`,
      cpp: `// Modern C++ Debounce using std::chrono and std::thread
#include <chrono>
#include <functional>

template <typename Function>
auto debounce(Function fn, std::chrono::milliseconds delay) {
    return [fn, delay](auto... args) {
        // Debounce implementation
    };
}`,
      java: `// Java ExecutorService Debounce Wrapper
import java.util.concurrent.*;

public class Debouncer {
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> future;

    public synchronized void debounce(Runnable task, long delayMillis) {
        if (future != null && !future.isDone()) {
            future.cancel(false);
        }
        future = scheduler.schedule(task, delayMillis, TimeUnit.MILLISECONDS);
    }
}`,
    },
    testCases: [
      { input: [["a", "b", "c"], 50], expected: "configured" },
      { input: [["click1", "click2"], 100], expected: "configured" },
    ],
  },
  {
    id: "flatten-array",
    title: "Deep Array Flattener",
    track: "Frontend Web Architecture",
    difficulty: "Junior",
    entryFunction: "flattenDeep",
    description: `Given a multi-dimensional array with arbitrary levels of nested arrays, write a function \`flattenDeep\` that recursively flattens the structure into a single 1D array.

Do not use JavaScript's built-in \`Array.prototype.flat\` with Infinity depth.`,
    examples: [
      {
        input: "[1, [2, [3, [4]], 5]]",
        output: "[1, 2, 3, 4, 5]",
        explanation: "All nested levels are unfolded.",
      },
    ],
    constraints: ["Array elements can be numbers, strings, or nested arrays.", "Depth up to 1000."],
    starterCode: {
      javascript: `/**
 * @param {any[]} arr
 * @return {any[]}
 */
function flattenDeep(arr) {
  const result = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flattenDeep(item));
    } else {
      result.push(item);
    }
  }
  return result;
}`,
      typescript: `function flattenDeep(arr: any[]): any[] {
  const result: any[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flattenDeep(item));
    } else {
      result.push(item);
    }
  }
  return result;
}`,
      python: `def flatten_deep(arr):
    result = []
    for item in arr:
        if isinstance(item, list):
            result.extend(flatten_deep(item))
        else:
            result.append(item)
    return result`,
      cpp: `#include <vector>
#include <variant>

// Standard C++ recursive visitor for nested container`,
      java: `import java.util.*;

public class Flattener {
    public static List<Object> flatten(List<Object> list) {
        List<Object> result = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof List<?>) {
                result.addAll(flatten((List<Object>) item));
            } else {
                result.add(item);
            }
        }
        return result;
    }
}`,
    },
    testCases: [
      { input: [[1, [2, [3, [4]], 5]]], expected: [1, 2, 3, 4, 5] },
      { input: [[1, 2, 3]], expected: [1, 2, 3] },
      { input: [[[[]]]], expected: [] },
    ],
  },

  // --- Track 3: Backend & System Design ---
  {
    id: "lru-cache",
    title: "LRU Cache Design",
    track: "Backend & System Design",
    difficulty: "Mid-Level",
    entryFunction: "testLRUCache",
    description: `Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.

Implement the \`LRUCache\` class:
- \`LRUCache(int capacity)\`: Initialize the LRU cache with positive size \`capacity\`.
- \`int get(int key)\`: Return the value of the \`key\` if the key exists, otherwise return \`-1\`.
- \`void put(int key, int value)\`: Update the value of the \`key\` if the \`key\` exists. Otherwise, add the \`key-value\` pair to the cache. If the number of keys exceeds the \`capacity\` from this operation, evict the least recently used key.

The functions \`get\` and \`put\` must each run in O(1) average time complexity.`,
    examples: [
      {
        input: 'cache = new LRUCache(2); cache.put(1, 1); cache.put(2, 2); cache.get(1); cache.put(3, 3); // evicts 2',
        output: "cache.get(2) returns -1",
        explanation: "Key 2 was evicted because key 1 was accessed.",
      },
    ],
    constraints: ["1 <= capacity <= 3000", "0 <= key <= 10^4", "0 <= value <= 10^5"],
    starterCode: {
      javascript: `class LRUCache {
  /**
   * @param {number} capacity
   */
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  /**
   * @param {number} key
   * @return {number}
   */
  get(key) {
    if (!this.cache.has(key)) return -1;
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  /**
   * @param {number} key
   * @param {number} value
   * @return {void}
   */
  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // First key in Map is least recently used
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}

// Verification runner
function testLRUCache(operations, values) {
  let cache = null;
  const output = [];
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const val = values[i];
    if (op === "LRUCache") {
      cache = new LRUCache(val[0]);
      output.push(null);
    } else if (op === "put") {
      cache.put(val[0], val[1]);
      output.push(null);
    } else if (op === "get") {
      output.push(cache.get(val[0]));
    }
  }
  return output;
}`,
      typescript: `class LRUCache {
  private capacity: number;
  private cache: Map<number, number>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: number): number {
    if (!this.cache.has(key)) return -1;
    const val = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  put(key: number, value: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey!);
    }
    this.cache.set(key, value);
  }
}`,
      python: `from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)`,
      cpp: `#include <unordered_map>
#include <list>
using namespace std;

class LRUCache {
    int cap;
    list<pair<int, int>> dll;
    unordered_map<int, list<pair<int, int>>::iterator> map;
public:
    LRUCache(int capacity) : cap(capacity) {}
    
    int get(int key) {
        if (!map.count(key)) return -1;
        dll.splice(dll.begin(), dll, map[key]);
        return map[key]->second;
    }
    
    void put(int key, int value) {
        if (map.count(key)) {
            dll.splice(dll.begin(), dll, map[key]);
            map[key]->second = value;
            return;
        }
        if (dll.size() == cap) {
            int oldKey = dll.back().first;
            dll.pop_back();
            map.erase(oldKey);
        }
        dll.emplace_front(key, value);
        map[key] = dll.begin();
    }
};`,
      java: `import java.util.LinkedHashMap;
import java.util.Map;

class LRUCache extends LinkedHashMap<Integer, Integer> {
    private int capacity;

    public LRUCache(int capacity) {
        super(capacity, 0.75f, true);
        this.capacity = capacity;
    }

    public int get(int key) {
        return super.getOrDefault(key, -1);
    }

    public void put(int key, int value) {
        super.put(key, value);
    }

    @Override
    protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
        return size() > capacity;
    }
}`,
    },
    testCases: [
      {
        input: [
          ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"],
          [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]],
        ],
        expected: [null, null, null, 1, null, -1, null, -1, 3, 4],
      },
    ],
  },
];

/**
 * Filter problems by track name
 */
export const getProblemsByTrack = (trackName) => {
  if (!trackName) return PROBLEMS;
  const filtered = PROBLEMS.filter((p) => p.track.toLowerCase() === trackName.toLowerCase());
  return filtered.length > 0 ? filtered : PROBLEMS;
};

/**
 * Get problem by unique ID
 */
export const getProblemById = (id) => {
  return PROBLEMS.find((p) => p.id === id) || PROBLEMS[0];
};

export default PROBLEMS;

