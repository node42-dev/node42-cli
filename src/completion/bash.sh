_n42_completions()
{
  local cur prev words cword
  _init_completion || return

  local commands="login logout me usage history discover"

  if [[ $cword -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
    return
  fi

  if [[ ${words[1]} == "discover" && $cword -eq 2 ]]; then
    COMPREPLY=( $(compgen -W "peppol" -- "$cur") )
    return
  fi
}

complete -F _n42_completions n42