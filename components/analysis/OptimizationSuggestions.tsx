'use client'

import { OptimizationSuggestion } from '@/types'

interface OptimizationSuggestionsProps {
  suggestions: OptimizationSuggestion[]
  show: boolean
}

export default function OptimizationSuggestions({ suggestions, show }: OptimizationSuggestionsProps) {
  if (!show) return null

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold mb-6 text-slate-900 border-b pb-3">Optimalisatie Suggesties</h2>
      
      {suggestions.length === 0 ? (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
          <div className="font-bold text-green-800 mb-1">Optimaal</div>
          <div className="text-green-700">
            De huidige planning is goed verdeeld over de dag. Er zijn geen grote pieken in de werkdruk.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="bg-slate-50 border-l-4 border-blue-600 p-4 rounded-lg"
            >
              <div className="font-bold text-blue-800 mb-1 text-sm uppercase tracking-wide">
                {suggestion.type}
              </div>
              <div className="text-slate-800 leading-relaxed">
                {suggestion.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

