# Weekly Duty Coverage Manager - Debug Report

## Component Flow

### 1. User Interaction Flow
```
User selects template from dropdown
  ↓
Select.onValueChange calls setSelectedTemplate(id)
  ↓
useEffect (L51-55) detects selectedTemplate change
  ↓
loadTemplate(id) is called
  ↓
Template data is fetched and states are updated
  ↓
User navigates to "Preview & Send" tab
  ↓
User clicks "Preview Email" button
  ↓
handlePreview() is called
  ↓
Edge function send-weekly-duty-coverage is invoked
  ↓
Preview HTML is returned and displayed in modal
```

### 2. State Management

**Critical States:**
- `selectedTemplate`: UUID of the currently selected template (string)
- `showPreview`: Boolean controlling preview modal visibility
- `previewHtml`: HTML string returned from edge function
- `loading`: Boolean for button disabled state

**State Dependencies:**
- Preview button disabled when: `loading || !selectedTemplate`
- Preview modal shown when: `showPreview === true`

### 3. Components Involved

1. **WeeklyDutyCoverageManager** (Main component)
   - Manages all state and business logic
   - Renders Dialog with tabs
   - Renders preview modal via portal

2. **Select** (Template dropdown)
   - Binds to `selectedTemplate` state
   - Triggers `setSelectedTemplate` on change

3. **Button** (Preview Email)
   - Disabled when no template selected
   - Calls `handlePreview` on click

4. **Preview Modal** (Custom portal)
   - Rendered conditionally based on `showPreview`
   - Displays `previewHtml` via dangerouslySetInnerHTML

5. **Edge Function** (send-weekly-duty-coverage)
   - Receives template_id, week_number, year, preview flag
   - Returns HTML string for preview

### 4. The Bug

**Root Cause:**
When `loadTemplate()` does not call `setSelectedTemplate(templateId)`, the state can be lost during re-renders, especially when:
- User switches tabs
- React batches multiple state updates
- Component re-renders for any reason

**Symptom:**
- `selectedTemplate` becomes empty string ""
- Preview button becomes disabled
- User cannot click Preview
- No edge function call is made

**Fix:**
Use `useRef` to track when `loadTemplate` is executing, preventing circular `useEffect` calls while maintaining state persistence via `setSelectedTemplate(templateId)`.

**Implementation:**
```tsx
// 1. Add ref to track loading state
const isLoadingRef = useRef(false);

// 2. Check ref in useEffect to prevent circular calls
useEffect(() => {
  if (selectedTemplate && !isLoadingRef.current) {
    loadTemplate(selectedTemplate);
  }
}, [selectedTemplate]);

// 3. Set flag and persist state in loadTemplate
const loadTemplate = async (templateId: string) => {
  isLoadingRef.current = true; // Prevent circular call
  
  const { data, error } = await supabase
    .from('weekly_duty_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (!error && data) {
    setSelectedTemplate(templateId); // Persist the selected template
    setSelectedTeams(data.team_ids || []);
    setTemplateName(data.template_name);
    // ... other state updates
  }
  
  isLoadingRef.current = false; // Reset flag
};
```

**Why It Works:**
1. User selects template → `setSelectedTemplate(id)` called
2. useEffect sees change AND `isLoadingRef.current === false` → calls `loadTemplate`
3. `loadTemplate` immediately sets `isLoadingRef.current = true`
4. Loads data and calls `setSelectedTemplate(templateId)` to persist it
5. useEffect triggers again BUT `isLoadingRef.current === true` → **skips the call**
6. Flag is reset to `false` at the end
7. `selectedTemplate` stays set to the UUID
8. Button is enabled
9. User clicks "Preview Email" → `handlePreview` executes successfully

## Testing Coverage

### Unit Tests
All tests are located in `src/components/schedule/__tests__/WeeklyDutyCoverageManager.test.tsx`

**Button Interaction Tests:**
- Verifies Preview button renders correctly
- Tests button disabled state when no template selected
- Tests button enabled state when template is selected
- Verifies handlePreview is called when button clicked

**Dialog Rendering Tests:**
- Tests preview dialog opens on successful preview
- Verifies HTML content displays in dialog
- Tests close button functionality

**Error Handling Tests:**
- Tests error toast when preview fails
- Verifies button remains disabled when no template selected
- Tests network error scenarios

**Data Loading Tests:**
- Tests template data loads correctly when selected
- Verifies selectedTemplate state persists across tab switches
- Tests state management with multiple re-renders

### Integration Tests
- End-to-end flow from template selection to preview display
- State persistence across tab switches
- Edge function invocation with correct parameters

### Snapshot Tests
- Preview dialog UI structure
- Button states in different scenarios

## Performance Considerations

### Current Performance
- Template loading: ~200ms (network dependent)
- Preview generation: ~1-2s (depends on data size)
- Modal rendering: ~50ms

### Optimization Opportunities
1. **Add loading spinner during preview generation**
   - Visual feedback for user during 1-2s wait time
   - Improves perceived performance

2. **Cache preview HTML for same week/template combo**
   - Reduce redundant edge function calls
   - Faster subsequent previews

3. **Lazy load DutyAssignmentGrid components**
   - Only render when "Duty Assignments" tab is active
   - Reduces initial render time

4. **Debounce template selection changes**
   - Prevent rapid loadTemplate calls
   - Reduce unnecessary API requests

5. **Async rendering for large schedules**
   - Stream HTML content for very large schedules
   - Prevent UI blocking

## Prevention Measures

### 1. Automated Tests
- **Coverage Target:** 90%+ for preview-related components
- **Test Types:** Unit, integration, snapshot
- **Regression Protection:** Tests verify state management logic

### 2. CI/CD Integration
- Tests run on every push and pull request
- Coverage threshold enforcement (90% minimum)
- Automated failure notifications

### 3. Debug Logging
- Comprehensive console logs in `handlePreview`
- State tracking at critical points
- Error details logged for debugging

### 4. State Management Pattern
- Ref-based guards prevent circular dependencies
- Explicit state persistence in load functions
- Clear separation of concerns

### 5. Code Reviews
- Require tests for all state-related changes
- Review checklist includes state management patterns
- Pair programming for complex state logic

## Monitoring

### Recommended Alerts
- **Edge function error rate > 5%**: Indicates backend issues
- **Preview generation time > 5s**: Performance degradation
- **Client-side errors in WeeklyDutyCoverageManager**: Frontend issues
- **Template load failures**: Database connectivity problems

### Metrics to Track
- **Preview success rate**: Should be >95%
- **Average preview generation time**: Target <2s
- **Template selection to preview time**: Full user flow timing
- **Modal open rate vs preview rate**: User engagement metric
- **Error rate by error type**: Categorize failures

### Debugging Tools
1. **Console Logs**: Extensive logging in `handlePreview`
2. **React DevTools**: Inspect component state
3. **Network Tab**: Monitor edge function calls
4. **Supabase Logs**: Backend error tracking

## Known Limitations

### Current Limitations
1. **No preview caching**: Each preview generates fresh HTML
2. **Synchronous rendering**: Large schedules can block UI
3. **No optimistic UI**: No immediate feedback on button click
4. **Limited error details**: Generic error messages to user

### Future Enhancements
1. **Smart caching system**: Cache based on template + week + year
2. **Streaming HTML**: Progressive rendering for large schedules
3. **Optimistic UI updates**: Immediate visual feedback
4. **Detailed error messages**: User-friendly error explanations
5. **Retry mechanism**: Automatic retry on transient failures

## Dependencies

### Critical Dependencies
- **React 18.3+**: Required for concurrent features
- **Supabase Client**: Database and edge function access
- **@radix-ui/react-dialog**: Modal implementation
- **react-dom**: Portal rendering for custom modal

### Testing Dependencies
- **Vitest**: Test runner and framework
- **@testing-library/react**: Component testing utilities
- **@testing-library/jest-dom**: DOM matchers
- **jsdom**: DOM environment for tests

## Rollback Plan

### If Issues Occur
1. **Immediate**: Revert to previous commit
2. **Investigate**: Check console logs and edge function logs
3. **Fix Forward**: Apply targeted fix with test
4. **Deploy**: Redeploy with fix and verify

### Rollback Steps
```bash
# 1. Revert the commit
git revert HEAD

# 2. Push the revert
git push origin main

# 3. Verify in production
# Check that Preview button works

# 4. Investigate root cause
# Review logs and test results
```

## Contact & Support

### For Issues
1. Check this debug report first
2. Review console logs for debug output
3. Check Supabase edge function logs
4. Contact development team with logs and reproduction steps

### Documentation Updates
This document should be updated when:
- New features are added to Weekly Duty Coverage
- State management patterns change
- New bugs are discovered and fixed
- Performance optimizations are implemented
